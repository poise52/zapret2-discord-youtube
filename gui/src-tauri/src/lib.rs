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
    
    let exe_path = root.join("exe").join("winws2.exe").to_string_lossy().into_owned();
    let preset = preset_path.to_string_lossy().into_owned();
    
    // Запуск через PowerShell с правами администратора (UAC)
    let ps_script = format!(
        "Start-Process -FilePath '{}' -ArgumentList '@\"{}\"' -Verb RunAs -WindowStyle Hidden",
        exe_path, preset
    );
    
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-Command", &ps_script]).current_dir(&root);
       
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    // Используем spawn() чтобы не блокировать GUI, так как процесс winws2 висит бесконечно
    let _child = cmd.spawn().map_err(|e| e.to_string())?;

    Ok("Proxy started".to_string())
}

#[tauri::command]
fn get_active_preset(app: tauri::AppHandle) -> Result<String, String> {
    let root = get_zapret_root(&app)?;
    let preset_name_path = root.join("utils").join("current_preset.txt");
    
    if preset_name_path.exists() {
        if let Ok(content) = std::fs::read_to_string(preset_name_path) {
            let name = content.trim().to_string();
            if !name.is_empty() {
                return Ok(name);
            }
        }
    }
    Ok("01_Default".to_string())
}

#[tauri::command]
fn check_proxy_status() -> Result<bool, String> {
    let mut cmd = Command::new("tasklist");
    cmd.args(["/FI", "IMAGENAME eq winws2.exe"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    if let Ok(output) = cmd.output() {
        let output_str = String::from_utf8_lossy(&output.stdout).to_lowercase();
        // Если tasklist находит процесс, он выводит его имя. Если нет - выводит "info: no tasks are running..."
        if output_str.contains("winws2.exe") {
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
fn get_all_presets(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let root = get_zapret_root(&app)?;
    let presets_dir = root.join("presets");
    let mut presets = Vec::new();
    
    if presets_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(presets_dir) {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "txt" {
                        let name = entry.path().file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        // Игнорируем файлы, начинающиеся с "_"
                        if !name.starts_with('_') && !name.is_empty() {
                            presets.push(name);
                        }
                    }
                }
            }
        }
    }
    presets.sort();
    Ok(presets)
}

#[tauri::command]
fn set_active_preset(app: tauri::AppHandle, name: &str) -> Result<String, String> {
    let root = get_zapret_root(&app)?;
    let preset_source = root.join("presets").join(format!("{}.txt", name));
    let preset_dest = root.join("utils").join("preset-active.txt");
    
    if !preset_source.exists() {
        return Err("Пресет не найден".to_string());
    }
    
    std::fs::copy(&preset_source, &preset_dest).map_err(|e| e.to_string())?;
    
    // Обновляем current_preset.txt для service.bat
    let state_file = root.join("utils").join("current_preset.txt");
    let _ = std::fs::write(state_file, name);
    
    Ok("Пресет установлен".to_string())
}

#[tauri::command]
fn stop_proxy() -> Result<String, String> {
    let ps_script = "Start-Process -FilePath 'taskkill.exe' -ArgumentList '/F', '/IM', 'winws2.exe' -Verb RunAs -WindowStyle Hidden";
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-Command", ps_script]);
    
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

    let ps_script = match command {
        "auto-setup" => {
            format!("Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '\"{}\"', 'silent' -Verb RunAs -WindowStyle Hidden -Wait", auto_setup_path)
        },
        "install-service" => {
            format!("Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '\"{}\"', 'task_install' -Verb RunAs -WindowStyle Hidden -Wait", service_bat_path)
        },
        "remove-service" => {
            format!("Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '\"{}\"', 'task_remove' -Verb RunAs -WindowStyle Hidden -Wait", service_bat_path)
        },
        "update-lists" => {
            format!("Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '\"{}\"', 'update_lists' -Verb RunAs -WindowStyle Hidden -Wait", service_bat_path)
        },
        _ => return Err("Unknown command".to_string()),
    };

    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-Command", &ps_script]).current_dir(&root);
    
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
        .invoke_handler(tauri::generate_handler![
            start_proxy, 
            stop_proxy, 
            execute_script, 
            get_active_preset,
            get_all_presets,
            set_active_preset,
            check_proxy_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
