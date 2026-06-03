use std::process::Command;
use std::path::PathBuf;
use std::env;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use tauri::Manager;

// Умный поиск корневой папки Zapret2 (там где лежит winws2.exe или service.bat)
fn get_zapret_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // В собранном приложении ресурсы (bin, utils и т.д.) лежат в папке ресурсов Tauri
    if let Ok(resource_path) = app.path().resource_dir() {
        // Tauri копирует относительные пути с сохранением структуры, поэтому "../../" превращается в "_up_/_up_"
        let bundled_root = resource_path.join("_up_").join("_up_");
        if bundled_root.join("service.bat").exists() {
            let clean_path = bundled_root.to_string_lossy().replace("\\\\?\\", "");
            return Ok(PathBuf::from(clean_path.to_string()));
        }
    }

    let mut current_dir = env::current_dir().map_err(|e| e.to_string())?;
    
    // Проверяем текущую директорию и на 3 уровня вверх (для tauri dev)
    for _ in 0..4 {
        if current_dir.join("service.bat").exists() {
            let clean_path = current_dir.to_string_lossy().replace("\\\\?\\", "");
            return Ok(PathBuf::from(clean_path.to_string()));
        }
        if !current_dir.pop() {
            break;
        }
    }
    
    Err("Не найдена корневая папка Zapret2 (service.bat не найден)".to_string())
}

#[tauri::command]
fn start_proxy(app: tauri::AppHandle) -> Result<String, String> {
    let root = get_zapret_root(&app)?;
    
    // Читаем текущий пресет, если он есть, иначе берем дефолтный
    let mut preset_path = root.join("utils").join("preset-active.txt");
    if !preset_path.exists() {
        preset_path = root.join("presets").join("01_Default.txt");
    }
    
    // Запуск через cmd.exe скрыто, без консольного окна
    let mut cmd = Command::new("cmd.exe");
    cmd.arg("/c")
       .arg(format!("\"{}\" @\"{}\"", root.join("exe").join("winws2.exe").display(), preset_path.display()))
       .current_dir(&root);
       
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let status = cmd.status().map_err(|e| e.to_string())?;

    if status.success() {
        Ok("Proxy started".to_string())
    } else {
        Err("Failed to start proxy".to_string())
    }
}

#[tauri::command]
fn get_active_preset(app: tauri::AppHandle) -> Result<String, String> {
    let root = get_zapret_root(&app)?;
    let preset_path = root.join("utils").join("preset-active.txt");
    
    if preset_path.exists() {
        if let Ok(content) = std::fs::read_to_string(preset_path) {
            let file_name = std::path::Path::new(content.trim())
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if !file_name.is_empty() {
                return Ok(file_name);
            }
        }
    }
    Ok("01_Default".to_string())
}

#[tauri::command]
fn stop_proxy() -> Result<String, String> {
    let mut cmd = Command::new("taskkill");
    cmd.args(["/F", "/IM", "winws2.exe"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let _ = cmd.status();
        
    Ok("Proxy stopped".to_string())
}

#[tauri::command]
fn execute_script(app: tauri::AppHandle, command: &str) -> Result<String, String> {
    let root = get_zapret_root(&app)?;
    
    // Сохраняем пути в String, чтобы они жили до конца функции (исправление ошибки E0716)
    let auto_setup_path = root.join("utils").join("auto-setup.bat").to_string_lossy().into_owned();
    let service_bat_path = root.join("service.bat").to_string_lossy().into_owned();
    let update_lists_path = root.join("utils").join("update-lists.ps1").to_string_lossy().into_owned();

    let (program, args) = match command {
        "auto-setup" => {
            ("cmd.exe", vec!["/c", auto_setup_path.as_str()])
        },
        "install-service" => {
            // Для установки службы нужно передавать нужные аргументы, если service.bat их поддерживает, либо использовать powershell
            // Здесь запускаем скрыто
            ("cmd.exe", vec!["/c", service_bat_path.as_str(), "install"])
        },
        "remove-service" => {
            ("cmd.exe", vec!["/c", service_bat_path.as_str(), "remove"])
        },
        "update-lists" => {
            ("powershell.exe", vec!["-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", update_lists_path.as_str()])
        },
        _ => return Err("Unknown command".to_string()),
    };

    let mut cmd = Command::new(program);
    cmd.args(&args).current_dir(&root);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let status = cmd.status().map_err(|e| e.to_string())?;

    if status.success() {
        Ok(format!("Executed {}", command))
    } else {
        Err(format!("Failed to execute {}", command))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_proxy, stop_proxy, execute_script, get_active_preset])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
