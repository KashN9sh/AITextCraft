import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFile, faPlus, faPen, faTrash, faCopy, faArrowRight, faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  DragOverlay,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { useDraggable, useDroppable } from '@dnd-kit/core';

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
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const contextMenuRef = useRef(null);
  const newFileInputRef = useRef(null);
  const renameInputRef = useRef(null);

  // Настройка сенсоров для drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Порог активации - 5 пикселей
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      // Порог активации - 5 пикселей
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const loadDirectoryContents = async (path = directoryPath) => {
    try {
      setLoading(true);
      const contents = await invoke("get_directory_contents", { path });
      setFiles(contents);
    } catch (error) {
      console.error("Ошибка при загрузке списка файлов:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubDirectory = async (path) => {
    try {
      const contents = await invoke("get_directory_contents", { path });
      setSubDirs(prev => ({
        ...prev,
        [path]: contents
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

  // Обработчики drag and drop
  const handleDragStart = (event) => {
    const { active } = event;
    setActiveDragItem(active.data.current.item);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const sourceItem = active.data.current.item;
      const targetItem = over.data.current.item;
      
      // Проверка: нельзя перетаскивать в себя или в свои дочерние элементы
      if (targetItem.path.startsWith(sourceItem.path + '/')) {
        console.warn('Нельзя перетащить директорию в её собственную поддиректорию');
        setActiveDragItem(null);
        setDropTarget(null);
        return;
      }
      
      try {
        let newPath;
        
        // Если цель - директория
        if (targetItem.is_dir) {
          // Если директория открыта, проверяем, не перетаскиваем ли мы в её содержимое
          if (expandedDirs.has(targetItem.path)) {
            // Проверяем, не перетаскиваем ли мы в дочерний элемент открытой директории
            const isOverChild = over.id.startsWith(targetItem.path + '/');
            if (isOverChild) {
              // Если перетаскиваем в дочерний элемент, используем путь дочернего элемента
              newPath = `${over.id}/${sourceItem.name}`;
            } else {
              // Если перетаскиваем в саму открытую директорию
              newPath = `${targetItem.path}/${sourceItem.name}`;
            }
          } else {
            // Если директория закрыта, просто перемещаем в неё
            newPath = `${targetItem.path}/${sourceItem.name}`;
          }
        } else {
          // Если цель - файл, перемещаем в ту же директорию
          const targetDir = targetItem.path.substring(0, targetItem.path.lastIndexOf('/'));
          newPath = `${targetDir}/${sourceItem.name}`;
        }
        
        await invoke("move_file", { 
          sourcePath: sourceItem.path, 
          destinationPath: newPath 
        });
        
        // Обновляем все загруженные директории
        loadDirectoryContents();
        Object.keys(subDirs).forEach(dir => {
          loadSubDirectory(dir);
        });
        
        // Если перемещали открытый файл, обновляем его путь
        if (currentFile?.path === sourceItem.path) {
          onFileSelect({
            ...currentFile,
            path: newPath
          });
        }
      } catch (error) {
        console.error("Ошибка при перемещении файла:", error);
      }
    }
    
    setActiveDragItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setDropTarget(over ? over.data.current.item : null);
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item, index) => (
      <Draggable key={item.path} id={item.path} item={item}>
        <Droppable id={item.path} item={item}>
          <div style={{ marginLeft: `${level * 20}px` }}>
            <div
              className={`file-item ${item.is_dir ? 'directory' : 'file'} 
                       ${currentFile?.path === item.path ? 'selected' : ''}`}
              onClick={() => handleItemClick(item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
            >
              <div className="file-item-content">
                <span className="file-icon">
                  <FontAwesomeIcon icon={item.is_dir ? (expandedDirs.has(item.path) ? faFolderOpen : faFolder) : faFile} />
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
        </Droppable>
      </Draggable>
    ));
  };

  // Функция для создания элементов с возможностью перетаскивания
  const createDraggableItems = (items, level = 0) => {
    return items.map((item, index) => (
      <div key={index} style={{ marginLeft: `${level * 20}px` }}>
        <div
          className={`file-item ${item.is_dir ? 'directory' : 'file'} ${currentFile?.path === item.path ? 'selected' : ''} 
                   ${isRenamingFile && renameItem?.path === item.path ? 'renaming' : ''}`}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <div
            id={`draggable-${item.path}`}
            data-id={item.path}
          >
            <span className="file-icon">
              <FontAwesomeIcon icon={item.is_dir ? (expandedDirs.has(item.path) ? faFolderOpen : faFolder) : faFile} />
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
              <span className="file-name">{item.name}</span>
            )}
          </div>
        </div>
        {item.is_dir && expandedDirs.has(item.path) && subDirs[item.path] && (
          <ul className="file-list">
            {createDraggableItems(subDirs[item.path], level + 1)}
          </ul>
        )}
      </div>
    ));
  };

  // Функция для рендеринга перетаскиваемого элемента в оверлее
  const renderDragOverlay = () => {
    if (!activeDragItem) return null;

    return (
      <div 
        className={`file-item ${activeDragItem.is_dir ? 'directory' : 'file'} dragging`}
      >
        <span className="file-icon">
          <FontAwesomeIcon icon={activeDragItem.is_dir ? faFolder : faFile} />
        </span>
        <span className="file-name">{activeDragItem.name}</span>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
    >
      <div className="file-explorer">
        {loading ? (
          <div className="loading">
            Загрузка...
          </div>
        ) : (
          <ul className="file-list">
            {isCreatingFile && (
              <li className="file-item new-file">
                <span className="file-icon">
                  <FontAwesomeIcon icon={faFile} />
                </span>
                <input
                  ref={newFileInputRef}
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={handleNewFileNameSubmit}
                  onBlur={() => setIsCreatingFile(false)}
                  placeholder="Введите имя файла..."
                  className="new-file-input"
                />
              </li>
            )}
            {files.length === 0 ? (
              <li className="empty-directory">
                Нет файлов
              </li>
            ) : (
              renderFileTree(files)
            )}
          </ul>
        )}

        {/* Глобальное контекстное меню для пустой области */}
        {contextMenu.show && !contextMenu.item && (
          <div
            ref={contextMenuRef}
            className="context-menu"
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            <div className="context-menu-item" onClick={handleCreateNewFile}>
              <span>Создать новый файл</span>
            </div>
          </div>
        )}

        {/* Контекстное меню для файла или директории */}
        {contextMenu.show && contextMenu.item && (
          <div
            ref={contextMenuRef}
            className="context-menu"
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            <div className="context-menu-item" onClick={handleRenameFile}>
              <span>Переименовать</span>
            </div>
            <div className="context-menu-item" onClick={handleDeleteFile}>
              <span>Удалить</span>
            </div>
            <div className="context-menu-item" onClick={handleCopyFile}>
              <span>Копировать</span>
            </div>
            <div className="context-menu-item" onClick={handleCreateNewFile}>
              <span>Создать новый файл</span>
            </div>
          </div>
        )}

        <DragOverlay modifiers={[restrictToWindowEdges]}>
          {activeDragItem && renderDragOverlay()}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// Компонент для вложенных элементов
function NestedItem({ 
  item, 
  level, 
  expandedDirs, 
  subDirs, 
  currentFile, 
  dropTarget, 
  handleItemClick, 
  handleContextMenu,
  isRenamingFile,
  renameItem,
  newFileName,
  setNewFileName,
  setIsRenamingFile,
  setRenameItem,
  renameInputRef,
  handleRenameSubmit
}) {
  return (
    <Draggable id={item.path} item={item}>
      <Droppable id={item.path} item={item}>
        <div 
          style={{ marginLeft: `${level * 20}px` }}
          className={`file-item ${item.is_dir ? 'directory' : 'file'} 
                   ${currentFile?.path === item.path ? 'selected' : ''}`}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <span className="file-icon">
            {item.is_dir ? (
              expandedDirs.has(item.path) ? (
                <FontAwesomeIcon icon={faFolderOpen} />
              ) : (
                <FontAwesomeIcon icon={faFolder} />
              )
            ) : null}
            <FontAwesomeIcon icon={item.is_dir ? (expandedDirs.has(item.path) ? faFolderOpen : faFolder) : faFile} />
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
            <span className="file-name">{item.name}</span>
          )}
        </div>
        {item.is_dir && expandedDirs.has(item.path) && subDirs[item.path] && (
          <ul className="file-list">
            {subDirs[item.path].map((subItem) => (
              <NestedItem 
                key={subItem.path} 
                item={subItem} 
                level={level + 1} 
                expandedDirs={expandedDirs}
                subDirs={subDirs}
                currentFile={currentFile}
                dropTarget={dropTarget}
                handleItemClick={handleItemClick}
                handleContextMenu={handleContextMenu}
                isRenamingFile={isRenamingFile}
                renameItem={renameItem}
                newFileName={newFileName}
                setNewFileName={setNewFileName}
                setIsRenamingFile={setIsRenamingFile}
                setRenameItem={setRenameItem}
                renameInputRef={renameInputRef}
                handleRenameSubmit={handleRenameSubmit}
              />
            ))}
          </ul>
        )}
      </Droppable>
    </Draggable>
  );
}

// Компонент-обертка для перетаскиваемых элементов
function Draggable({ id, item, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      item
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

// Компонент-обертка для областей, куда можно перетаскивать
function Droppable({ id, item, children }) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      item
    }
  });

  const style = {
    backgroundColor: isOver && item.is_dir ? 'rgba(255, 187, 108, 0.2)' : undefined,
    borderRadius: isOver && item.is_dir ? '4px' : undefined,
    padding: isOver && item.is_dir ? '4px' : undefined,
    margin: isOver && item.is_dir ? '-4px' : undefined,
    width: '100%',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}

export default FileExplorer; 