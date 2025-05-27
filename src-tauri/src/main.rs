// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::env;
use std::path::PathBuf;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[derive(serde::Serialize)]
struct FileItem {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct DirectoryHistory {
    path: String,
    name: String,
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

#[tauri::command]
async fn select_directory() -> Result<Option<DirectoryHistory>, String> {
    let file_dialog = rfd::AsyncFileDialog::new()
        .set_directory("/")
        .pick_folder()
        .await;
        
    match file_dialog {
        Some(folder) => {
            let path = folder.path().to_string_lossy().to_string();
            let name = folder.file_name();
            
            Ok(Some(DirectoryHistory { path, name }))
        },
        None => Ok(None), // Пользователь отменил выбор
    }
}

#[tauri::command]
async fn save_directory_history(directories: Vec<DirectoryHistory>) -> Result<(), String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Не удалось получить директорию конфигурации".to_string())?;
    
    let app_config_dir = config_dir.join("aitextcraft");
    fs::create_dir_all(&app_config_dir)
        .map_err(|e| e.to_string())?;
    
    let history_path = app_config_dir.join("directory_history.json");
    
    // Сохраняем историю в JSON файл
    let json = serde_json::to_string(&directories)
        .map_err(|e| e.to_string())?;
    
    fs::write(history_path, json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_directory_history() -> Result<Vec<DirectoryHistory>, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Не удалось получить директорию конфигурации".to_string())?;
    
    let app_config_dir = config_dir.join("aitextcraft");
    let history_path = app_config_dir.join("directory_history.json");
    
    // Проверяем, существует ли файл истории
    if !history_path.exists() {
        return Ok(Vec::new()); // Пустая история
    }
    
    // Загружаем историю из JSON файла
    let json = fs::read_to_string(history_path)
        .map_err(|e| e.to_string())?;
    
    let directories: Vec<DirectoryHistory> = serde_json::from_str(&json)
        .map_err(|e| e.to_string())?;
    
    Ok(directories)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Создаем меню приложения
            let file_menu = SubmenuBuilder::new(app, "Файл")
                .item(&MenuItemBuilder::with_id("save", "Сохранить")
                    .accelerator("cmdOrControl+S")
                    .build(app)?)
                .item(&MenuItemBuilder::with_id("load", "Загрузить")
                    .accelerator("cmdOrControl+O")
                    .build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("quit", "Выход")
                    .accelerator("cmdOrControl+Q")
                    .build(app)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Правка")
                .item(&MenuItemBuilder::with_id("copy", "Копировать")
                    .accelerator("cmdOrControl+C")
                    .build(app)?)
                .item(&MenuItemBuilder::with_id("cut", "Вырезать")
                    .accelerator("cmdOrControl+X")
                    .build(app)?)
                .item(&MenuItemBuilder::with_id("paste", "Вставить")
                    .accelerator("cmdOrControl+V")
                    .build(app)?)
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "Вид")
                .item(&MenuItemBuilder::with_id("preview", "Предпросмотр")
                    .accelerator("cmdOrControl+P")
                    .build(app)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file_menu, &edit_menu, &view_menu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                match event.id().0.as_str() {
                    "save" => {
                        app.emit("menu-save", ()).unwrap();
                    }
                    "load" => {
                        app.emit("menu-load", ()).unwrap();
                    }
                    "preview" => {
                        app.emit("menu-preview", ()).unwrap();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_file,
            load_file,
            get_directory_contents,
            select_directory,
            save_directory_history,
            load_directory_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
