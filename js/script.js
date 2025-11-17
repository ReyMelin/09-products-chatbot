// Store conversation history - this keeps track of all messages between user and AI
let conversationHistory = [];

// Cloudflare Workers URL that connects to OpenAI API
const cloudflareGatewayUrl = 'https://round-hill-afb6.rherma26-a5b.workers.dev';

// Main function to initialize the chat interface
async function initChat() {
    // Get all required DOM elements
    const chatToggle = document.getElementById('chatToggle');
    const chatBox = document.getElementById('chatBox');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const openIcon = document.querySelector('.open-icon');
    const closeIcon = document.querySelector('.close-icon');

    // Load rentals data from JSON file
    let rentalsData = [];
    try {
        const response = await fetch('./rentals.json');
        rentalsData = await response.json();
        console.log('Rentals data loaded successfully');
    } catch (error) {
        console.error('Error loading rentals data:', error);
    }

    // Toggle chat visibility and swap icons
    chatToggle.addEventListener('click', function() {
        chatBox.classList.toggle('active');
        openIcon.style.display = chatBox.classList.contains('active') ? 'none' : 'block';
        closeIcon.style.display = chatBox.classList.contains('active') ? 'block' : 'none';
    });

    // Send message to OpenAI API via Cloudflare Workers
    async function sendToOpenAI(userMessage) {
        // Add the user's new message to our conversation history array
        conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        // Create a system message that tells the AI how to behave
        // This includes all the rental data so AI can make recommendations
        const systemMessage = {
            role: 'system',
            content: `You are a helpful assistant for Offbeat Retreats, a vacation rental company specializing in quirky, unusual vacation rentals.

Your job is to guide users through a SHORT conversation (2-3 questions maximum) to match them with the perfect rental.

Here are the available rentals with their details:
${JSON.stringify(rentalsData, null, 2)}

CONVERSATION FLOW:
1. If this is the first message, greet them warmly and ask ONE question about their vacation preferences (e.g., what type of experience they're looking for, budget range, group size, or special interests).
2. After they answer, ask ONE MORE follow-up question to narrow down their preferences.
3. After 2-3 questions, recommend the TOP 1-2 rentals that best match their answers. Explain WHY each rental fits their needs.

FORMAT YOUR RESPONSES:
- Use line breaks between different sections (press Enter twice for paragraph breaks)
- Use bullet points (•) for listing rental features
- Use emojis occasionally to add personality (like 🏡 ✨ 🎉)
- Keep sentences SHORT and friendly
- Be enthusiastic about the quirky nature of these rentals!
- Use casual, conversational language like you're texting a friend

Remember: Keep the conversation SHORT. Don't ask more than 3 questions total before making recommendations.`
        };

        try {
            // Send the full conversation to the Cloudflare Worker
            // The worker will forward it to OpenAI with the API key
            const response = await fetch(cloudflareGatewayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [systemMessage, ...conversationHistory],
                    temperature: 0.8, // Increased from 0.7 to make responses more creative and natural
                    max_tokens: 800 // Limit response length to keep it concise
                })
            });

            // Check if the response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the response data from OpenAI via the worker
            const data = await response.json();
            
            // Extract the AI's message from the response
            const assistantMessage = data.choices[0].message.content;
            
            // Add the AI's response to our conversation history
            conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });

            // Return the AI's message so we can display it
            return assistantMessage;
        } catch (error) {
            console.error('Error calling OpenAI API via Cloudflare Worker:', error);
            return 'Sorry, I encountered an error. Please try again.';
        }
    }

    // Handle user input and process messages
    async function handleUserInput(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (message) {
            // Clear the input field
            userInput.value = '';

            // Display the user's message
            const userMessage = document.createElement('div');
            userMessage.classList.add('message', 'user');
            userMessage.textContent = message;
            chatMessages.appendChild(userMessage);

            // Show typing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot');
            typingIndicator.textContent = 'Typing...';
            chatMessages.appendChild(typingIndicator);

            // Scroll to the latest message
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Get AI response by sending the full conversation
            const botResponse = await sendToOpenAI(message);

            // Remove typing indicator
            chatMessages.removeChild(typingIndicator);

            // Display bot response with enhanced formatting
            const botMessage = document.createElement('div');
            botMessage.classList.add('message', 'bot');
            
            // Convert line breaks to HTML and preserve formatting
            // This handles both single \n and double \n\n for paragraphs
            botMessage.innerHTML = botResponse
                .replace(/\n\n/g, '<br><br>') // Double line breaks = paragraphs
                .replace(/\n/g, '<br>');       // Single line breaks = new lines
            
            chatMessages.appendChild(botMessage);

            // Scroll to the latest message
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Listen for form submission
    document.getElementById('chatForm').addEventListener('submit', handleUserInput);
}

// Initialize the chat interface
initChat();
