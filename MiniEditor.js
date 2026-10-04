/**
 * Минималистичный WYSIWYG-редактор MiniEditor
 * Поддерживает Bootstrap 5, Bootstrap Icons, кастомные плагины через Dropdown и автосброс в модалках
 */
export class MiniEditor {
    constructor(textareaSelector, options = {}) {
        this.textarea = document.querySelector(textareaSelector);
        if (!this.textarea) {
            console.warn(`MiniEditor: Элемент "${textareaSelector}" не найден.`);
            return;
        }

        // Настройки по умолчанию
        this.options = Object.assign({
            height: '250px',
            maxHeight: '400px',
            placeholder: 'Введите текст здесь...',
            buttons: [] // Массив для кастомных кнопок из инициализации
        }, options);

        this.container = null;
        this.toolbar = null;
        this.editorArea = null;
        this.customActions = {}; // Хранилище для колбэков кастомных кнопок
        this.isInternalUpdate = false;

        this._buildUI();
        this._bindEvents();
        this.updateTextarea(); // Синхронизируем стартовое значение
    }

    /**
     * Создает структуру редактора и скрывает исходный textarea
     */
    _buildUI() {
        // Создаем главный контейнер (карточка Bootstrap)
        this.container = document.createElement('div');
        this.container.className = 'card shadow-sm mini-editor-container mb-3';

        // Базовый шаблон панели инструментов с Bootstrap Icons
        let toolbarHTML = `
            <div class="card-header bg-white d-flex flex-wrap align-items-center gap-1 p-2 border-bottom">
                <!-- Назад / Вперед -->
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="undo" title="Назад"><i class="bi bi-arrow-left-short"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="redo" title="Вперед"><i class="bi bi-arrow-right-short"></i></button>
                <div class="vr mx-1"></div>

                <!-- Заголовки -->
                <select class="form-select form-select-sm d-inline-block w-auto border-0 bg-light" data-cmd="formatBlock" title="Заголовок">
                    <option value="P">Обычный текст</option>
                    <option value="H2">Заголовок 2</option>
                    <option value="H3">Заголовок 3</option>
                    <option value="H4">Заголовок 4</option>
                </select>
                <div class="vr mx-1"></div>

                <!-- Форматирование -->
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="bold" title="Жирный"><i class="bi bi-type-bold"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="italic" title="Курсив"><i class="bi bi-type-italic"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="underline" title="Подчеркнутый"><i class="bi bi-type-underline"></i></button>
                <div class="vr mx-1"></div>

                <!-- Списки -->
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="insertUnorderedList" title="Маркированный список"><i class="bi bi-list-ul"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="insertOrderedList" title="Нумерованный список"><i class="bi bi-list-ol"></i></button>
                <div class="vr mx-1"></div>

                <!-- Ссылки и Код -->
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="createLink" title="Вставить ссылку"><i class="bi bi-link-45deg"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="unlink" title="Удалить ссылку"><i class="bi bi-link"></i></button>
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="codeBlock" title="Блок кода"><i class="bi bi-code-slash"></i></button>
                <div class="vr mx-1"></div>

                <!-- Экран -->
                <button type="button" class="btn btn-sm btn-outline-secondary border-0" data-cmd="toggleFullscreen" title="На весь экран"><i class="bi bi-arrows-fullscreen"></i></button>
                <div class="vr mx-1"></div>
        `;

        // ГЕНЕРАЦИЯ ДРОПДАУНА ДЛЯ КАСТОМНЫХ КНОПОК
        if (Array.isArray(this.options.buttons) && this.options.buttons.length > 0) {
            let dropdownHTML = `
                <div class="dropdown d-inline-block">
                    <button class="btn btn-sm btn-outline-secondary border-0 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Дополнительно">
                        <i class="bi bi-gear-fill me-1"></i> Дополнительно
                    </button>
                    <ul class="dropdown-menu shadow-sm">
            `;

            this.options.buttons.forEach((btn, index) => {
                const actionId = `custom_action_${index}`;
                // Сохраняем колбэк во внутреннее хранилище экземпляра
                this.customActions[actionId] = btn.action;

                dropdownHTML += `
                    <li>
                        <button type="button" class="dropdown-item d-flex align-items-center gap-2" data-custom-cmd="${actionId}" title="${btn.title || ''}">
                            ${btn.label} <span class="small text-muted ms-auto">${btn.title || ''}</span>
                        </button>
                    </li>
                `;
            });

            dropdownHTML += `
                    </ul>
                </div>
                <div class="vr mx-1"></div>
            `;

            toolbarHTML += dropdownHTML;
        }

        // Финальный элемент очистки форматирования
        toolbarHTML += `
                <!-- Очистка -->
                <button type="button" class="btn btn-sm btn-outline-secondary border-0 text-danger" data-cmd="removeFormat" title="Очистить форматирование"><i class="bi bi-eraser"></i></button>
            </div>
        `;

        this.container.innerHTML = toolbarHTML;
        this.toolbar = this.container.querySelector('.card-header');

        // Создаем область редактирования
        this.editorArea = document.createElement('div');
        this.editorArea.className = 'card-body p-3 overflow-auto';
        this.editorArea.contentEditable = 'true';
        this.editorArea.style.minHeight = this.options.height;
        this.editorArea.style.maxHeight = this.options.maxHeight;
        this.editorArea.style.outline = 'none';

        // --- НАСТРАИВАЕМ ВИРТУАЛЬНЫЙ ПЛЕЙСХОЛДЕР ЧЕРЕЗ АТРИБУТ ---
        this.editorArea.setAttribute('data-placeholder', this.options.placeholder);

        // Заполняем только реальным текстом. Если текста нет — оставляем пустой <br>
        this.editorArea.innerHTML = this.textarea.value.trim() ? this.textarea.value.trim() : '<br>';


        // Изолированные CSS стили интерфейса редактора
        const styleNode = document.createElement('style');
        styleNode.textContent = `
            .mini-editor-container:focus-within {
                border-color: #86b7fe !important;
                box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25) !important;
            }
            .mini-editor-container .dropdown-item {
                cursor: pointer;
            }
            .mini-editor-container .dropdown-item i {
                font-size: 1rem;
            }
            
            /* --- CSS МАГИЯ ДЛЯ ПЛЕЙСХОЛДЕРА --- */
            [contenteditable="true"]:empty:before {
                content: attr(data-placeholder);
                color: #6c757d; /* Серый цвет Bootstrap для плейсхолдеров */
                pointer-events: none;
                display: block; 
            }
            [contenteditable="true"] > br:only-child:before {
                content: attr(data-placeholder);
                color: #6c757d;
                pointer-events: none;
            }
        `;
        this.container.appendChild(styleNode);

        // Синхронизируем стартовый текст
        // this.editorArea.innerHTML = this.textarea.value.trim() || `<p>${this.options.placeholder}</p>`;
        if (this.textarea.value.trim()) {
            this.editorArea.innerHTML = this.textarea.value.trim();
        } else {
            // Важно: пустой <br> вместо <p> placeholder </p>
            this.editorArea.innerHTML = `<br>`;
        }
        this.container.appendChild(this.editorArea);

        // Встраиваем в DOM и скрываем textarea
        this.textarea.parentNode.insertBefore(this.container, this.textarea.nextSibling);
        this.textarea.classList.add('d-none');
    }

    /**
     * Навешивает все необходимые обработчики событий
     */
    _bindEvents() {
        // 1. Клики по панели инструментов (Тулбару) и Дропдауну
        this.toolbar.addEventListener('click', (e) => {
            // Обработка стандартных кнопок
            const button = e.target.closest('button:not(.dropdown-item)');
            if (button && button.hasAttribute('data-cmd')) {
                e.preventDefault();
                this._executeCommand(button.getAttribute('data-cmd'));
                return;
            }

            // Обработка кастомных кнопок из Dropdown меню
            const customItem = e.target.closest('.dropdown-item');
            if (customItem && customItem.hasAttribute('data-custom-cmd')) {
                e.preventDefault();
                const actionId = customItem.getAttribute('data-custom-cmd');
                if (typeof this.customActions[actionId] === 'function') {
                    // Вызываем внешнее действие
                    this.customActions[actionId]();
                    // Автоматически возвращаем фокус в поле ввода после клика
                    this.editorArea.focus();
                }
            }
        });

        // 2. Изменение выпадающего списка (выбор заголовков)
        const select = this.toolbar.querySelector('select');
        select.addEventListener('change', (e) => {
            this._executeCommand('formatBlock', e.target.value);
            setTimeout(() => e.target.value = "P", 100);
        });

        // 3. Перехват клавиш (Tab для списков, Enter внутри блоков кода)
        this.editorArea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const command = e.shiftKey ? 'outdent' : 'indent';
                document.execCommand(command, false, null);
                this.updateTextarea();
            }

            // ... внутри метода _bindEvents() в обработчике keydown ...

            if (e.key === 'Enter') {
                const selection = window.getSelection();
                if (!selection.rangeCount) return;

                // 1. ПРОВЕРКА КОНТЕКСТА: Ищем, не находимся ли мы внутри кода или списка
                const isInCode = selection.anchorNode.nodeType === Node.ELEMENT_NODE
                    ? selection.anchorNode.closest('pre')
                    : selection.anchorNode.parentElement.closest('pre');

                const isInList = selection.anchorNode.nodeType === Node.ELEMENT_NODE
                    ? selection.anchorNode.closest('li')
                    : selection.anchorNode.parentElement.closest('li');

                // 2. ЕСЛИ ЭТО ОБЫЧНЫЙ ТЕКСТ (не код и не список) -> Принудительно генерируем <br>
                if (!isInCode && !isInList) {
                    e.preventDefault(); // Запрещаем браузеру создавать абзацы <p> или блоки <div>

                    // Нативно вставляем перевод строки <br> строго в позицию курсора
                    document.execCommand('insertLineBreak', false, null);

                    this.updateTextarea(); // Синхронизируем изменения с textarea
                    return; // Выходим из обработчика, чтобы не выполнялся код для PRE
                }

                // 3. ЛОГИКА ДЛЯ БЛОКОВ КОДА (остается без изменений)
                const codeElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE
                    ? selection.anchorNode.closest('code')
                    : selection.anchorNode.parentElement.closest('code');

                if (codeElement) {
                    const preElement = codeElement.closest('pre');
                    const currentNode = selection.anchorNode;
                    const totalBRs = codeElement.querySelectorAll('br');

                    if (totalBRs.length > 0) {
                        const lastBR = totalBRs[totalBRs.length - 1];

                        if (currentNode === lastBR || currentNode.nextSibling === lastBR || currentNode.lastChild === lastBR || totalBRs.length >= 2 && textAfterCursorIsWhitespace()) {

                            function textAfterCursorIsWhitespace() {
                                const clonedRange = selection.getRangeAt(0).cloneRange();
                                clonedRange.selectNodeContents(codeElement);
                                clonedRange.setStart(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
                                return clonedRange.toString().trim() === '';
                            }

                            if (textAfterCursorIsWhitespace()) {
                                e.preventDefault();

                                while (codeElement.lastChild && (codeElement.lastChild.nodeName === 'BR' || codeElement.lastChild.textContent.trim() === '')) {
                                    codeElement.removeChild(codeElement.lastChild);
                                }
                                if (codeElement.innerHTML === '') codeElement.innerHTML = '\n';

                                const p = document.createElement('p');
                                p.innerHTML = '<br>';
                                preElement.parentNode.insertBefore(p, preElement.nextSibling);

                                const newRange = document.createRange();
                                newRange.setStart(p, 0);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);

                                this.updateTextarea();
                                return;
                            }
                        }
                    }
                }
            }

        });

        // 4. Очистка от "мусорных" стилей при вставке стороннего контента
        this.editorArea.addEventListener('paste', (e) => {
            e.preventDefault();
            let text = (e.originalEvent || e).clipboardData.getData('text/plain');
            const isInCode = window.getSelection().anchorNode.parentElement.closest('pre');

            if (isInCode) {
                document.execCommand('insertText', false, text);
            } else {
                const formattedText = text.replace(/\n/g, '<br>');
                document.execCommand('insertHTML', false, formattedText);
            }
            this.updateTextarea();
        });

        // 5. Синхронизация при ручном вводе текста пользователем
        this.editorArea.addEventListener('input', () => this.updateTextarea());

        // 6. Автосброс полноэкранного режима при закрытии модалки Bootstrap
        const parentModal = this.container.closest('.modal');
        if (parentModal) {
            parentModal.addEventListener('hide.bs.modal', () => {
                const modalDialog = this.container.closest('.modal-dialog');
                if (modalDialog && modalDialog.classList.contains('modal-fullscreen')) {
                    modalDialog.classList.remove('modal-fullscreen');
                    const btnIcon = this.toolbar.querySelector('[data-cmd="toggleFullscreen"] i');
                    if (btnIcon) btnIcon.className = 'bi bi-arrows-fullscreen';
                }
            });
        }

        // 7. MutationObserver + Сеттер для автозаполнения через внешние скрипты (fillForm)
        this.observer = new MutationObserver(() => {
            if (this.isInternalUpdate) return; // ИГНОРИРУЕМ собственные изменения при вводе текста

            if (this.editorArea.innerHTML !== this.textarea.value) {
                this.editorArea.innerHTML = this.textarea.value || '<br>';
            }
        });
        this.observer.observe(this.textarea, { attributes: true, childList: true, characterData: true });

        const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        Object.defineProperty(this.textarea, 'value', {
            get: function() { return descriptor.get.call(this); },
            set: (val) => {
                descriptor.set.call(this.textarea, val);

                if (this.isInternalUpdate) return; // ИГНОРИРУЕМ собственные изменения при вводе текста

                if (this.editorArea.innerHTML !== val) {
                    this.editorArea.innerHTML = val || '<br>';
                }
            }
        });
    } // Конец метода _bindEvents()

    /**
     * Выполняет нативные команды форматирования и кастомные команды панели
     */
    _executeCommand(command, value = null) {
        this.editorArea.focus();

        if (command === 'createLink') {
            const url = prompt('Введите URL ссылки:', 'https://');
            if (url && url !== 'https://') document.execCommand(command, false, url);
        } else if (command === 'toggleFullscreen') {
            const modalDialog = this.container.closest('.modal-dialog');
            if (modalDialog) {
                const isFullscreen = modalDialog.classList.toggle('modal-fullscreen');
                const btnIcon = this.toolbar.querySelector('[data-cmd="toggleFullscreen"] i');
                if (btnIcon) btnIcon.className = isFullscreen ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
            }
        } else if (command === 'codeBlock') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            // Ищем, не находимся ли мы уже внутри существующего блока кода
            const preElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE
                ? selection.anchorNode.closest('pre')
                : selection.anchorNode.parentElement.closest('pre');

            if (preElement) {
                // ЕСЛИ МЫ ВНУТРИ КОДА -> Превращаем обратно в обычный текст
                const p = document.createElement('p');
                p.innerHTML = preElement.querySelector('code')?.innerHTML || preElement.innerHTML;
                p.innerHTML = p.innerHTML.replace(/(<br\s*\/?>)+$/, '');
                if (p.innerHTML.trim() === '') p.innerHTML = '<br>';

                preElement.parentNode.replaceChild(p, preElement);

                const newRange = document.createRange();
                newRange.selectNodeContents(p);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // ЕСЛИ МЫ НЕ В БЛОКЕ КОДА -> Создаем его с учетом <br>
                let selectedText = range.toString();
                let nodeToReplace = null;

                // Если текст не выделен мышкой, берем только ТЕКУЩУЮ строку (текстовый узел курсора)
                if (!selectedText) {
                    let currentNode = selection.anchorNode;

                    // Если кликнули на пустую строку, где стоит <br>
                    if (currentNode.nodeType === Node.ELEMENT_NODE) {
                        if (currentNode.tagName === 'BR') {
                            nodeToReplace = currentNode;
                            selectedText = '';
                        } else {
                            // Если это контейнер, берем текущий дочерний элемент по офсету
                            const child = currentNode.childNodes[selection.startOffset];
                            if (child) {
                                nodeToReplace = child;
                                selectedText = child.textContent || '';
                            }
                        }
                    } else {
                        // Если это обычный текст, забираем контент только этого текстового узла строки
                        nodeToReplace = currentNode;
                        selectedText = currentNode.textContent || '';
                    }
                }

                // Создаем новые изолированные теги кода
                const pre = document.createElement('pre');
                pre.className = 'custom-code-block';
                const code = document.createElement('code');
                code.textContent = selectedText || '\n';
                pre.appendChild(code);

                if (!range.toString() && nodeToReplace) {
                    // Если текст не был выделен, аккуратно заменяем в DOM только текущую строчку
                    nodeToReplace.parentNode.replaceChild(pre, nodeToReplace);
                } else {
                    // Если текст был выделен мышкой, вырезаем его и вставляем блок кода
                    range.deleteContents();
                    range.insertNode(pre);
                }

                // Переводим курсор внутрь созданного блока кода
                const newRange = document.createRange();
                newRange.selectNodeContents(code);
                newRange.collapse(selectedText ? false : true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } else {
            document.execCommand(command, false, value);
        }

        this.updateTextarea();
    }

    /**
     * Записывает текущий HTML-код обратно в оригинальный textarea с жесткой очисткой от <p>
     */
    updateTextarea() {
        this.isInternalUpdate = true; // Включаем блокировку: редактор знает, что изменения его собственные

        let html = this.editorArea.innerHTML;

        if (html === '<p><br></p>' || html === '<br>' || html === '<p></p>' || html.trim() === '') {
            this.textarea.value = '';
        } else {
            // Фильтр тегов <p>
            html = html.replace(/<\/p>\s*<p[^>]*>/gi, '<br>');
            html = html.replace(/^<p[^>]*>/gi, '');
            html = html.replace(/<\/p>$/gi, '');
            html = html.replace(/<p><\/p>/gi, '<br>');

            this.textarea.value = html.trim();
        }

        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));

        this.isInternalUpdate = false; // Выключаем блокировку: редактор снова готов слушать внешние скрипты
    }

    /**
     * Уничтожает редактор, возвращая оригинальный textarea в исходное состояние
     * Вызывается автоматически через CleanupManager при уходе со страницы
     */
    destroy() {
        // 1. Отключаем слежку MutationObserver, чтобы избежать утечек памяти
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // 2. Удаляем сгенерированный интерфейс редактора (тулбар, область ввода, встроенные стили)
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        // 3. Возвращаем видимость оригинальному textarea
        if (this.textarea) {
            this.textarea.classList.remove('d-none');
        }

        // 4. Очищаем ссылки на внутренние элементы для сборщика мусора
        this.toolbar = null;
        this.editorArea = null;
        this.customActions = {};

        console.log('[MiniEditor] Успешно уничтожен, оригинальный textarea восстановлен.');
    }

} // Конец класса MiniEditor

