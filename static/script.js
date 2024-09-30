document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const newChatBtn = document.getElementById('new-chat-btn');
    const modelSelect = document.getElementById('model-select');
    const chatList = document.getElementById('chat-list');
    const chatTitle = document.getElementById('chat-title');

    let currentChatId = null;

    // Load chat list
    loadChatList();

    // Load current conversation
    loadCurrentChat();

    chatForm.addEventListener('submit', event => {
        event.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return;

        appendMessage('user', message);
        messageInput.value = '';
        scrollToBottom();

        // Show loading animation
        const loadingMessage = appendLoadingMessage();
        scrollToBottom();

        // Send message to backend
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                model: modelSelect.value,
                chat_id: currentChatId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Remove loading animation
            loadingMessage.remove();
            appendMessage('assistant', data.assistant_message);
            currentChatId = data.chat_id;
            MathJax.typeset();  // Re-render MathJax equations
            scrollToBottom();
            loadChatList();  // Refresh chat list
        });
    });

    newChatBtn.addEventListener('click', () => {
        fetch('/new_chat')
            .then(response => response.json())
            .then(data => {
                chatBox.innerHTML = '';
                currentChatId = data.chat_id;
                chatTitle.textContent = data.chat_name;
                loadChatList();
            });
    });

    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role, 'new');

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('bubble');

        // Process markdown and code blocks
        const formattedContent = formatMarkdown(content);
        bubbleDiv.innerHTML = formattedContent;

        messageDiv.appendChild(bubbleDiv);
        chatBox.appendChild(messageDiv);

        // Animate the new message
        gsap.fromTo(messageDiv,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
        );

        // Setup copy buttons for code blocks
        setupCopyButtons();
    }

    function appendLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'assistant');

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('bubble');

        const loadingAnimation = document.createElement('div');
        loadingAnimation.classList.add('loading-animation');

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('loading-dot');
            loadingAnimation.appendChild(dot);
        }

        bubbleDiv.appendChild(loadingAnimation);
        messageDiv.appendChild(bubbleDiv);
        chatBox.appendChild(messageDiv);

        // Animate the loading dots
        gsap.to('.loading-dot', {
            scale: 1.2,
            opacity: 1,
            stagger: 0.2,
            repeat: -1,
            yoyo: true,
            ease: "power2.inOut"
        });

        return messageDiv;
    }

    function scrollToBottom() {
        gsap.to(chatBox, {
            scrollTop: chatBox.scrollHeight,
            duration: 0.5,
            ease: "power2.out"
        });
    }

    function formatMarkdown(content) {
        // Handle bold and italic: **text**
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong><em>$1</em></strong>');

        // Handle headings: # to ###### Heading
        content = content.replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, headingText) => {
            const level = hashes.length;
            return `<h${level}>${headingText}</h${level}>`;
        });

        // Handle code blocks with or without language specification
        content = content.replace(/```(?:(\w+)\n)?([\s\S]*?)```/g, (match, lang, code) => {
            const languageClass = lang ? ` class="language-${lang}"` : '';
            return `
                <div class="code-block">
                    <button class="copy-btn">Copy</button>
                    <pre><code${languageClass}>${code.trim()}</code></pre>
                </div>
            `;
        });

        return content;
    }

    function setupCopyButtons() {
        const copyButtons = document.querySelectorAll('.copy-btn');
        copyButtons.forEach(button => {
            if (!button.dataset.listenerAdded) {
                button.dataset.listenerAdded = 'true';
                button.onclick = () => {
                    const codeBlock = button.nextElementSibling.querySelector('code');
                    const codeText = codeBlock.innerText;
                    navigator.clipboard.writeText(codeText).then(() => {
                        // Provide feedback
                        button.textContent = 'Copied!';
                        setTimeout(() => {
                            button.textContent = 'Copy';
                        }, 2000);
                    });
                };
            }
        });
    }

    function loadChatList() {
        fetch('/get_chat_list')
            .then(response => response.json())
            .then(data => {
                chatList.innerHTML = '';
                data.chats.forEach(chat => {
                    const li = document.createElement('li');
                    li.textContent = chat.name;
                    li.onclick = () => loadChat(chat.id);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                    };

                    const renameBtn = document.createElement('button');
                    renameBtn.textContent = 'Rename';
                    renameBtn.onclick = (e) => {
                        e.stopPropagation();
                        renameChat(chat.id);
                    };

                    li.appendChild(renameBtn);
                    li.appendChild(deleteBtn);
                    chatList.appendChild(li);
                });
            });
    }

    function loadChat(chatId) {
        fetch(`/get_chat/${chatId}`)
            .then(response => response.json())
            .then(data => {
                chatBox.innerHTML = '';
                currentChatId = chatId;
                chatTitle.textContent = data.chat_name;
                data.conversation.forEach(message => appendMessage(message.role, message.content));
                scrollToBottom();
            });
    }

    function deleteChat(chatId) {
        fetch(`/delete_chat/${chatId}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(() => {
                loadChatList();
                if (currentChatId === chatId) {
                    chatBox.innerHTML = '';
                    currentChatId = null;
                    chatTitle.textContent = 'New Chat';
                }
            });
    }

    function renameChat(chatId) {
        const newName = prompt("Enter new name for the chat:");
        if (newName) {
            fetch(`/rename_chat/${chatId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_name: newName })
            })
            .then(response => response.json())
            .then(data => {
                loadChatList();
                if (currentChatId === chatId) {
                    chatTitle.textContent = data.new_name;
                }
            });
        }
    }

    function loadCurrentChat() {
        fetch('/get_current_chat')
            .then(response => response.json())
            .then(data => {
                currentChatId = data.chat_id;
                chatTitle.textContent = data.chat_name;
                data.conversation.forEach(message => appendMessage(message.role, message.content));
                scrollToBottom();
            });
    }
});
