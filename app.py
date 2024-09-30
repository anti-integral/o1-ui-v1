from flask import Flask, render_template, request, jsonify
import openai
import anthropic  # Import the anthropic module
import os
from uuid import uuid4

app = Flask(__name__)
app.secret_key = 'your_secret_key'

# Set your OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Set your Anthropic API key
anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)

# Store chats in memory (you might want to use a database in a production environment)
chats = {}
chat_counter = 0

# Home route
@app.route('/')
def index():
    return render_template('index.html')

# Route to handle chat messages
@app.route('/chat', methods=['POST'])
def chat():
    global chat_counter
    data = request.json
    user_message = data['message']
    model = data['model']
    chat_id = data['chat_id']

    if chat_id not in chats:
        chat_counter += 1
        chat_id = str(uuid4())
        chats[chat_id] = {
            'messages': [],
            'name': f'Chat {chat_counter}',
            'counter': chat_counter
        }

    conversation = chats[chat_id]['messages']

    # Append user message
    conversation.append({"role": "user", "content": user_message})

    if model == 'claude-3-5-sonnet-20240620':
        # Prepare messages for Anthropic API
        messages = [{"role": msg["role"], "content": msg["content"]} for msg in conversation]

        # Call Anthropic's API
        response = anthropic_client.messages.create(
            model=model,
            max_tokens=1000,
            temperature=1,
            messages=messages
        )

        # Extract the assistant's message from the 'content' field
        assistant_message = ""
        for content_block in response.content:
            if content_block.type == "text":
                assistant_message += content_block.text

    else:
        # Call OpenAI's Chat API with the selected model
        response = openai.ChatCompletion.create(
            model=model,
            messages=conversation,
            temperature=1
        )

        # Extract the assistant's message from OpenAI response
        assistant_message = response.choices[0].message['content']

    # Append assistant message
    conversation.append({"role": "assistant", "content": assistant_message})

    # Save updated conversation
    chats[chat_id]['messages'] = conversation

    return jsonify({'assistant_message': assistant_message, 'chat_id': chat_id})

# Route to start a new chat
@app.route('/new_chat')
def new_chat():
    global chat_counter
    chat_counter += 1
    chat_id = str(uuid4())
    chats[chat_id] = {
        'messages': [],
        'name': f'Chat {chat_counter}',
        'counter': chat_counter
    }
    return jsonify({'status': 'New chat created.', 'chat_id': chat_id, 'chat_name': f'Chat {chat_counter}'})

# Route to retrieve chat list
@app.route('/get_chat_list')
def get_chat_list():
    chat_list = [{'id': chat_id, 'name': chat_info['name'], 'counter': chat_info['counter']}
                 for chat_id, chat_info in chats.items()]
    chat_list.sort(key=lambda x: x['counter'], reverse=True)
    return jsonify({'chats': chat_list})

# Route to retrieve a specific chat
@app.route('/get_chat/<chat_id>')
def get_chat(chat_id):
    chat_info = chats.get(chat_id, {'messages': [], 'name': 'Unknown Chat'})
    return jsonify({'conversation': chat_info['messages'], 'chat_name': chat_info['name']})

# Route to delete a chat
@app.route('/delete_chat/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    if chat_id in chats:
        del chats[chat_id]
    return jsonify({'status': 'Chat deleted.'})

# Route to get the current chat
@app.route('/get_current_chat')
def get_current_chat():
    chat_id = next(iter(chats.keys())) if chats else None
    chat_info = chats.get(chat_id, {'messages': [], 'name': 'New Chat'}) if chat_id else {'messages': [], 'name': 'New Chat'}
    return jsonify({'chat_id': chat_id, 'conversation': chat_info['messages'], 'chat_name': chat_info['name']})

# Route to rename a chat
@app.route('/rename_chat/<chat_id>', methods=['POST'])
def rename_chat(chat_id):
    new_name = request.json['new_name']
    if chat_id in chats:
        chats[chat_id]['name'] = new_name
        return jsonify({'status': 'Chat renamed.', 'new_name': new_name})
    return jsonify({'status': 'Chat not found.'}), 404

if __name__ == '__main__':
    app.run(debug=True)