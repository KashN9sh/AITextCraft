import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFolderPlus, faClock, faHistory } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';

function WelcomeScreen({ onSelectDirectory }) {
  const [recentDirectories, setRecentDirectories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загружаем историю директорий при монтировании компонента
  useEffect(() => {
    loadDirectoryHistory();
  }, []);

  // Загрузка истории директорий
  const loadDirectoryHistory = async () => {
    try {
      setLoading(true);
      const history = await invoke("load_directory_history");
      setRecentDirectories(history || []);
    } catch (error) {
      console.error("Ошибка при загрузке истории директорий:", error);
    } finally {
      setLoading(false);
    }
  };

  // Функция выбора директории через системный диалог
  const handleSelectDirectory = async () => {
    try {
      const directory = await invoke("select_directory");
      if (directory) {
        // Добавляем новую директорию в историю
        const updatedHistory = [directory, ...recentDirectories.filter(dir => dir.path !== directory.path)].slice(0, 10);
        setRecentDirectories(updatedHistory);
        
        // Сохраняем историю
        await invoke("save_directory_history", { directories: updatedHistory });
        
        // Передаем директорию в родительский компонент
        onSelectDirectory(directory);
      }
    } catch (error) {
      console.error("Ошибка при выборе директории:", error);
    }
  };

  // Обработчик клика по директории из истории
  const handleDirectoryClick = async (directory) => {
    // Обновляем историю, чтобы выбранная директория была первой
    const updatedHistory = [directory, ...recentDirectories.filter(dir => dir.path !== directory.path)].slice(0, 10);
    setRecentDirectories(updatedHistory);
    
    // Сохраняем историю
    await invoke("save_directory_history", { directories: updatedHistory });
    
    // Передаем директорию в родительский компонент
    onSelectDirectory(directory);
  };

  return (
    <motion.div 
      className="welcome-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="welcome-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h1>AITextCraft</h1>
        <p>Элегантный Markdown редактор</p>
      </motion.div>

      <motion.div 
        className="welcome-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <motion.button
          className="select-dir-button"
          onClick={handleSelectDirectory}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FontAwesomeIcon icon={faFolderPlus} />
          Выбрать директорию
        </motion.button>
      </motion.div>

      <motion.div 
        className="recent-directories"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <h2>
          <FontAwesomeIcon icon={faHistory} />
          Недавние директории
        </h2>
        <AnimatePresence>
          {loading ? (
            <motion.div
              className="loading-history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Загрузка истории...
            </motion.div>
          ) : (
            <ul className="directory-list">
              {recentDirectories.map((dir, index) => (
                <motion.li
                  key={dir.path}
                  className="directory-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectDirectory(dir)}
                >
                  <FontAwesomeIcon icon={faFolderOpen} className="dir-icon" />
                  <div className="dir-info">
                    <div className="dir-name">{dir.name}</div>
                    <div className="dir-path">{dir.path}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default WelcomeScreen; 