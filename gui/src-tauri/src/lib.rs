use std::process::Command;
use std::path::PathBuf;
use std::env;

use tauri::Manager;

// Умный поиск корневой папки Zapret2 (там где лежит winws2.exe или service.bat)
fn get_zapret_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // В собранном приложении ресурсы (bin, utils и т.д.) лежат в папке ресурсов Tauri
    if let Ok(resource_path) = app.path().resource_dir() {
        // Tauri копирует относительные пути с сохранением структуры, поэтому "../../" превращается в "_up_/_up_"
        let bundled_root = resource_path.join("_up_").join("_up_");
        if bundled_root.join("service.bat").exists() {
            return Ok(bundled_root);
        }
    }

    let mut current_dir = env::current_dir().map_err(|e| e.to_string())?;
    
    // Проверяем текущую директорию и на 3 уровня вверх (для tauri dev)
    for _ in 0..4 {
        if current_dir.join("service.bat").exists() {
            return Ok(current_dir);
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
    
    // Запуск через cmd.exe чтобы отработал WinDivert и не висела консоль
    let status = Command::new("cmd.exe")
        .arg("/c")
        .arg(format!("start /min \"\" \"{}\" @\"{}\"", root.join("exe").join("winws2.exe").display(), preset_path.display()))
        .current_dir(&root)
        .status()
        .map_err(|e| e.to_string())?;

    if status.success() {
        Ok("Proxy started".to_string())
    } else {
        Err("Failed to start proxy".to_string())
    }
}

#[tauri::command]
fn stop_proxy() -> Result<String, String> {
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "winws2.exe"])
        .status();
        
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
            ("cmd.exe", vec!["/c", "start", "\"\"", auto_setup_path.as_str()])
        },
        "install-service" => {
            // service.bat install
            ("cmd.exe", vec!["/c", "start", "\"\"", service_bat_path.as_str(), "1"])
        },
        "remove-service" => {
            // service.bat remove
            ("cmd.exe", vec!["/c", "start", "\"\"", service_bat_path.as_str(), "3"])
        },
        "update-lists" => {
            ("powershell.exe", vec!["-ExecutionPolicy", "Bypass", "-File", update_lists_path.as_str()])
        },
        _ => return Err("Unknown command".to_string()),
    };

    let status = Command::new(program)
        .args(&args)
        .current_dir(&root)
        .status()
        .map_err(|e| e.to_string())?;

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
        .invoke_handler(tauri::generate_handler![start_proxy, stop_proxy, execute_script])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
