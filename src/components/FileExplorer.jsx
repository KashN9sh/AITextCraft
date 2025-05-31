import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFileAlt, faPlus, faPen, faTrash, faCopy, faArrowRight, faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { createPortal } from 'react-dom';

function FileExplorer({ onFileSelect, directoryPath, currentFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null });
  const [newFileName, setNewFileName] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [subDirs, setSubDirs] = useState({});
  const contextMenuRef = useRef(null);
  const newFileInputRef = useRef(null);
  const renameInputRef = useRef(null);

  const loadDirectoryContents = async (path = directoryPath) => {
    try {
      setLoading(true);
      const contents = await invoke("get_directory_contents", { path });
      // Фильтруем содержимое: оставляем только папки и .md файлы
      const filteredContents = contents.filter(item => 
        item.is_dir || item.name.toLowerCase().endsWith('.md')
      );
      setFiles(filteredContents);
    } catch (error) {
      console.error("Ошибка при загрузке списка файлов:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubDirectory = async (path) => {
    try {
      const contents = await invoke("get_directory_contents", { path });
      // Фильтруем содержимое поддиректории
      const filteredContents = contents.filter(item => 
        item.is_dir || item.name.toLowerCase().endsWith('.md')
      );
      setSubDirs(prev => ({
        ...prev,
        [path]: filteredContents
      }));
    } catch (error) {
      console.error("Ошибка при загрузке содержимого поддиректории:", error);
    }
  };

  // Загружаем директорию при монтировании компонента или изменении пути
  useEffect(() => {
    if (directoryPath) {
      loadDirectoryContents(directoryPath);
    }
  }, [directoryPath]);

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setContextMenu({ show: false, x: 0, y: 0, item: null });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Фокус на поле ввода при создании нового файла
  useEffect(() => {
    if (isCreatingFile && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [isCreatingFile]);

  // Фокус на поле ввода при переименовании файла
  useEffect(() => {
    if (isRenamingFile && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [isRenamingFile]);

  // Обработчик клика по файлу или директории
  const handleItemClick = async (item) => {
    if (item.is_dir) {
      // Если это директория, переключаем её состояние
      const newExpandedDirs = new Set(expandedDirs);
      if (expandedDirs.has(item.path)) {
        newExpandedDirs.delete(item.path);
      } else {
        newExpandedDirs.add(item.path);
        // Загружаем содержимое директории, если оно ещё не загружено
        if (!subDirs[item.path]) {
          await loadSubDirectory(item.path);
        }
      }
      setExpandedDirs(newExpandedDirs);
    } else {
      // Если это файл, вызываем обработчик выбора файла
      onFileSelect(item);
    }
  };

  const handleContextMenu = (e, item = null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      item: item
    });
  };

  const handleCreateNewFile = async () => {
    setContextMenu({ show: false, x: 0, y: 0, item: null });
    setIsCreatingFile(true);
    setNewFileName("");
  };

  const handleNewFileNameSubmit = async (e) => {
    if (e.key === "Enter" && newFileName.trim()) {
      try {
        const fullPath = `${directoryPath}/${newFileName.trim()}`;
        await invoke("create_file", { path: fullPath });
        setIsCreatingFile(false);
        loadDirectoryContents(); // Перезагружаем список файлов
        
        // Открываем созданный файл в редакторе
        onFileSelect({
          name: newFileName.trim(),
          path: fullPath,
          is_dir: false
        });
      } catch (error) {
        console.error("Ошибка при создании файла:", error);
      }
    } else if (e.key === "Escape") {
      setIsCreatingFile(false);
    }
  };

  const handleRenameFile = () => {
    setContextMenu({ show: false, x: 0, y: 0, item: null });
    if (contextMenu.item) {
      setRenameItem(contextMenu.item);
      setNewFileName(contextMenu.item.name);
      setIsRenamingFile(true);
    }
  };

  const handleRenameSubmit = async (e) => {
    if (e.key === "Enter" && newFileName.trim() && renameItem) {
      try {
        const oldPath = renameItem.path;
        const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newFileName.trim();
        
        await invoke("rename_file", { oldPath, newPath });
        setIsRenamingFile(false);
        setRenameItem(null);
        loadDirectoryContents();
        
        // Если это был открытый файл, обновляем его путь
        if (currentFile?.path === oldPath) {
          onFileSelect({
            name: newFileName.trim(),
            path: newPath,
            is_dir: renameItem.is_dir
          });
        }
      } catch (error) {
        console.error("Ошибка при переименовании файла:", error);
      }
    } else if (e.key === "Escape") {
      setIsRenamingFile(false);
      setRenameItem(null);
    }
  };

  const handleDeleteFile = async () => {
    setContextMenu({ show: false, x: 0, y: 0, item: null });
    if (contextMenu.item) {
      try {
        const result = await invoke("delete_file", { path: contextMenu.item.path });
        loadDirectoryContents();
      } catch (error) {
        console.error("Ошибка при удалении файла:", error);
      }
    }
  };

  const handleCopyFile = async () => {
    setContextMenu({ show: false, x: 0, y: 0, item: null });
    if (contextMenu.item) {
      try {
        // Получаем новое имя файла (добавляем "копия")
        const fileName = contextMenu.item.name;
        const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
        const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
        const newName = `${baseName}_копия${extension}`;
        const newPath = contextMenu.item.path.substring(0, contextMenu.item.path.lastIndexOf('/') + 1) + newName;
        
        await invoke("copy_file", { 
          sourcePath: contextMenu.item.path, 
          destinationPath: newPath 
        });
        loadDirectoryContents();
      } catch (error) {
        console.error("Ошибка при копировании файла:", error);
      }
    }
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item, index) => (
      <div key={item.path} style={{ marginLeft: `${level * 20}px` }}>
        <div
          className={`file-item ${item.is_dir ? 'directory' : 'file'} 
                   ${currentFile?.path === item.path ? 'selected' : ''}`}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <div className="file-item-content">
            <span className="file-icon">
              <FontAwesomeIcon 
                icon={
                  item.is_dir 
                    ? (expandedDirs.has(item.path) ? faFolderOpen : faFolder)
                    : faFileAlt
                } 
              />
            </span>
            {isRenamingFile && renameItem?.path === item.path ? (
              <input
                ref={renameInputRef}
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={handleRenameSubmit}
                onBlur={() => {
                  setIsRenamingFile(false);
                  setRenameItem(null);
                }}
                className="rename-file-input"
              />
            ) : (
              <span className="file-name">
                {item.name}
              </span>
            )}
          </div>
        </div>
        {item.is_dir && expandedDirs.has(item.path) && subDirs[item.path] && (
          <div>
            {renderFileTree(subDirs[item.path], level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="file-explorer">
      <div className="file-list">
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : files.length === 0 ? (
          <div className="empty-directory">Директория пуста</div>
        ) : (
          renderFileTree(files)
        )}
      </div>
      {contextMenu.show && createPortal(
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
        >
          {contextMenu.item ? (
            <>
              <div className="context-menu-item" onClick={handleRenameFile}>Переименовать</div>
              <div className="context-menu-item" onClick={handleDeleteFile}>Удалить</div>
              <div className="context-menu-item" onClick={handleCopyFile}>Копировать</div>
              <div className="context-menu-item" onClick={handleCreateNewFile}>Создать новый файл</div>
            </>
          ) : (
            <div className="context-menu-item" onClick={handleCreateNewFile}>Создать новый файл</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default FileExplorer; 