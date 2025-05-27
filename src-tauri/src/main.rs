// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::env;
use tauri::Manager;

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_file, load_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
