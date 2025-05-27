// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::env;
use std::path::PathBuf;
use tauri::Manager;

#[derive(serde::Serialize)]
struct FileItem {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
async fn save_file(content: String, file_name: String) -> Result<(), String> {
    let exe_path = env::current_exe()
        .map_err(|e| e.to_string())?;
    let app_dir = exe_path.parent()
        .ok_or_else(|| "Не удалось получить директорию приложения".to_string())?;
    
    // Создаем директорию, если она не существует
    fs::create_dir_all(app_dir)
        .map_err(|e| e.to_string())?;
    
    let file_path = app_dir.join(file_name);
    
    fs::write(file_path, content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_file(file_name: String) -> Result<String, String> {
    let exe_path = env::current_exe()
        .map_err(|e| e.to_string())?;
    let app_dir = exe_path.parent()
        .ok_or_else(|| "Не удалось получить директорию приложения".to_string())?;
    
    let file_path = app_dir.join(file_name);
    
    fs::read_to_string(file_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_directory_contents(path: Option<String>) -> Result<Vec<FileItem>, String> {
    let dir_path = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        let exe_path = env::current_exe()
            .map_err(|e| e.to_string())?;
        exe_path.parent()
            .ok_or_else(|| "Не удалось получить директорию приложения".to_string())?
            .to_path_buf()
    };

    let entries = fs::read_dir(&dir_path)
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        
        // Получаем имя файла/директории
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Неизвестно")
            .to_string();
            
        let path_str = path.to_string_lossy().to_string();
        
        items.push(FileItem {
            name,
            path: path_str,
            is_dir: metadata.is_dir(),
        });
    }
    
    // Сортируем: сначала директории, потом файлы, в алфавитном порядке
    items.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    
    Ok(items)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_file, load_file, get_directory_contents])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
