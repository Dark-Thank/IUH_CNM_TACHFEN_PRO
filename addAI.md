I am developing a real-time chat application using ReactJS for the frontend and NodeJS for the backend. A Gemini API key has already been configured in the .env file.

Please analyze the existing project structure before making any changes and only modify the necessary parts to implement the AI features described below. Do not break or affect any existing chat functionality.

========================
FEATURE 1: AI SMART REPLY
=========================

Goal:
Add an AI-powered smart reply feature.

Business Logic:

1. Display reply suggestions only when:

   * The latest message in the conversation was sent by the other user.
   * Do not display suggestions if the latest message was sent by the current user.

2. When the condition is met:

   * Collect the latest 3 to 5 messages from the conversation.
   * Send them to Gemini for context analysis.
   * Gemini should return exactly 3 short and relevant reply suggestions.

3. Gemini Prompt Requirements:

   * Analyze the conversation context.
   * Generate natural human-like responses.
   * Return exactly 3 reply suggestions.
   * Do not include explanations.
   * Do not include numbering.
   * Return only a JSON array.

Example:

```json
[
  "Okay, sounds good.",
  "I'll join the meeting.",
  "Can we move it to 9 AM?"
]
```

4. User Interface:

Display the suggestions as clickable chips/buttons.

Example:

```text
[ Okay, sounds good. ]
[ I'll join the meeting. ]
[ Can we move it to 9 AM? ]
```

5. Placement Requirements:

The suggestion area must:

* Be displayed directly above the message input field.
* Be displayed directly below the message list.
* Never cover or overlap chat messages.
* Not use a popup.
* Not use a modal.
* Not use floating elements that overlap the chat area.

Desired layout:

```text
-------------------------
Message List
Message List
Message List
-------------------------

[ Suggestion 1 ]
[ Suggestion 2 ]
[ Suggestion 3 ]

-------------------------
Message Input
-------------------------
```

6. User Interaction:

When a suggestion is clicked:

* Insert the suggestion text into the input field.
* Do not send the message automatically.
* Allow the user to edit the text before sending.

7. Optimization Requirements:

* Only request AI suggestions when the latest message changes.
* Do not repeatedly call Gemini while the user is typing.
* Cache suggestions by conversationId whenever possible.
* Avoid unnecessary API calls.

========================
FEATURE 2: AUTO TRANSLATION
===========================

Goal:
Automatically translate incoming messages from the other participant into the user's language.

Business Logic:

1. Add a new option inside the three-dot message menu:

"Auto Translate"

2. When Auto Translate is enabled:

Step 1:

* Collect approximately 5 to 10 recent messages sent by the current user.
* Send them to Gemini to determine the user's primary language.

Example:

User messages:

```text
Hello
How are you?
See you tomorrow
```

Gemini detects:

```text
English
```

Step 2:

* Whenever the other participant sends a new message,
* Automatically translate that message into the detected user language.

3. Language Detection Prompt:

Analyze the following messages and determine the primary language used.

Return only the language name.

Examples:

```text
English
Vietnamese
Japanese
Korean
```

4. Translation Prompt:

Translate the following text into:
{userLanguage}

Return only the translated text.
Do not provide explanations.

5. User Interface:

Original message:

```text
Hello, how are you?
```

Translated message:

```text
Xin chào, bạn khỏe không?
```

Display format:

```text
--------------------------------
Hello, how are you?
Xin chào, bạn khỏe không?
--------------------------------
```

6. Display Rules:

* Always preserve the original message.
* Display the translation directly below the original.
* Use a smaller font size.
* Use a lighter text color.
* Never replace the original message.

7. Status Indicator:

When Auto Translate is enabled:

Display a badge or indicator:

```text
🌐 Auto Translate ON
```

This should appear in a suitable location such as:

* The conversation header
* The chat toolbar
* Another visible conversation-level area

8. Persistence:

* Save the Auto Translate state per conversation.
* Restore the state after page refresh.
* Preserve the user's preference across sessions if possible.

========================
TECHNICAL REQUIREMENTS
======================

1. Analyze the current codebase before making changes.

2. Reuse existing components whenever possible.

3. Do not modify the existing real-time chat flow.

4. Do not change the current database schema unless absolutely necessary.

5. Add only the minimum required AI-related APIs.

6. Use Gemini API with the API key already configured in the .env file.

7. Implement complete production-ready code including:

* ReactJS frontend
* NodeJS backend
* API routes
* Gemini service layer
* State management
* UI components
* Loading states
* Error handling
* API integration

8. Before generating code, provide:

* A list of files that need to be modified.
* A list of new files that need to be created.
* The reason for each modification.

After completing the project analysis, proceed with the implementation.
