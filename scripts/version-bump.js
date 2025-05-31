import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для обновления версии
function incrementVersion(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    if (patch === 12) {
        return `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
}

// Функция для обновления версии в package.json
function updatePackageVersion() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    package.version = incrementVersion(package.version);
    fs.writeFileSync(packagePath, JSON.stringify(package, null, 2));
}

// Функция для обновления версии в tauri.conf.json
function updateTauriVersion() {
    const tauriPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
    const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
    tauri.version = incrementVersion(tauri.version);
    fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2));
}

// Обновляем версии
updatePackageVersion();
updateTauriVersion(); 