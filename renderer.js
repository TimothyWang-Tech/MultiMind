// renderer.js
window.addEventListener('DOMContentLoaded', () => {
    // --- 元素获取 ---
    const progressBarContainer = document.getElementById('progress-bar-container');
    const notificationContainer = document.getElementById('notification-container');
    
    // --- 左侧边栏逻辑 ---
    // ... (保持不变) ...
    const icons = document.querySelectorAll('#sidebar .icon[data-service]');
    let currentActive = null;
    icons.forEach(icon => {
        icon.addEventListener('click', () => {
            const serviceKey = icon.dataset.service;
            window.electronAPI.showView(serviceKey);
            if (currentActive) currentActive.classList.remove('active');
            icon.classList.add('active');
            currentActive = icon;
        });
    });
    const firstIcon = document.querySelector('#sidebar .icon[data-service]');
    if (firstIcon) firstIcon.click();
    const reloadButton = document.getElementById('reload-page');
    reloadButton.addEventListener('click', () => window.electronAPI.reloadCurrentView());

    // --- 进度条逻辑 ---
    let appReady = false;
    let webviewReady = false;
    function updateProgressBar() {
        progressBarContainer.classList.toggle('hidden', appReady && webviewReady);
    }
    window.electronAPI.setLoadingState((isLoading) => {
        webviewReady = !isLoading;
        updateProgressBar();
    });

    // --- 通知逻辑 ---
    const showNotification = (message) => {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 2000); // 2秒后消失
    };
    window.electronAPI.onShowNotification(showNotification);

    // --- 右侧剪贴板逻辑 ---
    const rightSidebar = document.getElementById('right-sidebar');
    const toggleButton = document.getElementById('toggle-clipboard');
    const clipboardList = document.getElementById('clipboard-list');
    const dropContainer = document.getElementById('clipboard-list-container');

    toggleButton.addEventListener('click', () => {
        const isHidden = rightSidebar.classList.toggle('hidden');
        window.electronAPI.toggleRightSidebar(!isHidden);
    });

    const updateClipboardUI = async () => {
        const items = await window.electronAPI.getInitialClipboard();
        clipboardList.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'clipboard-item';
            li.textContent = item.name;
            li.draggable = true;
            
            // **已更新**: 根据文件类型决定点击行为
            if (item.name.endsWith('.txt')) {
                li.classList.add('is-text');
                li.title = `点击复制内容，拖拽使用\n路径: ${item.path}`;
                li.addEventListener('click', () => {
                    window.electronAPI.copyTextFromFile(item.path);
                });
            } else {
                li.title = `点击打开，拖拽使用\n路径: ${item.path}`;
                li.addEventListener('click', () => {
                    window.electronAPI.openItem(item.path);
                });
            }

            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = '删除';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.electronAPI.deleteClipboardItem(item.path);
            });
            li.appendChild(deleteBtn);
            
            li.addEventListener('dragstart', (e) => {
                e.preventDefault();
                window.electronAPI.startDrag(item.path);
                const onDragEnd = () => {
                    window.electronAPI.deleteClipboardItem(item.path);
                    window.removeEventListener('dragend', onDragEnd);
                }
                window.addEventListener('dragend', onDragEnd, { once: true });
            });

            clipboardList.appendChild(li);
        });
    };

    // ... (拖拽事件监听和初始化保持不变) ...
    dropContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropContainer.classList.add('dragover'); });
    dropContainer.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dropContainer.classList.remove('dragover'); });
    dropContainer.addEventListener('drop', async (e) => {
        e.preventDefault(); e.stopPropagation(); dropContainer.classList.remove('dragover');
        const files = e.dataTransfer.files;
        const text = e.dataTransfer.getData('text/plain');
        if (files.length > 0) {
            for (const file of files) { await window.electronAPI.saveDroppedItem({ type: 'file', content: file.path, name: file.name }); }
        } else if (text) {
            await window.electronAPI.saveDroppedItem({ type: 'text', content: text });
        }
    });
    window.electronAPI.onClipboardUpdate(updateClipboardUI);
    updateClipboardUI().then(() => {
        // app 初始化完成
        appReady = true;
        updateProgressBar();
    });
});
