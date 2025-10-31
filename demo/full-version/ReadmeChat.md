# Chat Functionality Documentation

## Overview

The chat feature in this project (Materio MUI Next.js Admin Template) is a simple messaging application built with TypeScript, Material-UI (MUI), and Redux Toolkit. It allows users to exchange messages with contacts, manage user statuses, and view chat history. The chat is currently implemented as a demo/prototype with mock data stored in a fake database (`src/fake-db/apps/chat`), making it suitable for UI demonstration without real backend integration.

Key features include:
- User status management (online, offline, busy, away).
- Contact list with search functionality.
- Real-time-like message display (simulated locally).
- Unread message counters.
- Responsive design for mobile and desktop.
- Integration-ready with external chat libraries like react-chat.

The chat does not include real-time WebSocket connections, authentication, or persistent storage—data resets on page reload.

## Architecture and How It Works

### Core Components
The chat is structured around Redux for state management and React components for UI rendering. Data flows from Redux to components, with actions updating the state.

#### Redux Store (`src/redux-store/slices/chat.ts`)
- **State Structure**: Based on `ChatDataType` (see Types below).
  - `profileUser`: Current user's profile.
  - `contacts`: List of available contacts.
  - `chats`: Array of chat threads, each containing messages and metadata.
  - `activeUser`: Currently selected contact for chatting.
- **Reducers**: Handle state updates via dispatched actions.
- **Initial State**: Loaded from `src/fake-db/apps/chat` (mock data).

#### UI Components (`src/views/apps/chat/`)
- **`index.tsx`**: Main wrapper combining sidebar and content.
- **`SidebarLeft.tsx`**: Left panel with user profile, contact search, and chat list. Displays last messages, timestamps, and unread counts.
- **`ChatContent.tsx`**: Main chat area. Shows placeholder if no active user; otherwise, displays chat header and message log.
- **`ChatLog.tsx`**: Renders messages grouped by sender, with timestamps and delivery status. Auto-scrolls to bottom on new messages.
- **`SendMsgForm.tsx`**: Input form for sending messages.
- **`UserProfileLeft.tsx` / `UserProfileRight.tsx`**: User profile panels (left for current user, right for active contact).
- **`AvatarWithBadge.tsx`**: Avatar component with status indicator.

#### Data Flow
1. User selects a contact in `SidebarLeft` → Dispatches `getActiveUserData` → Updates `activeUser` and resets unread messages.
2. Messages are displayed from `chats.find(chat => chat.userId === activeUser.id).chat`.
3. Sending a message: User types in `SendMsgForm` → Dispatches `sendMsg` → Adds message to chat array, moves chat to top of list.
4. Components re-render based on Redux state changes.

#### Responsiveness
- On small screens (`< lg`), the left sidebar collapses into a drawer.
- Uses MUI breakpoints and custom hooks for media queries.

### Types (`src/types/apps/chatTypes.ts`)
- **`StatusType`**: `'busy' | 'away' | 'online' | 'offline'`
- **`StatusObjType`**: Maps `StatusType` to MUI theme colors.
- **`ProfileUserType`**: Current user data (id, role, about, avatar, fullName, status, settings).
- **`ContactType`**: Contact data (id, fullName, role, about, avatar?, avatarColor?, status).
- **`UserChatType`**: Message structure (message: string, time: string | Date, senderId: number, msgStatus?: {isSent, isDelivered, isSeen}).
- **`ChatType`**: Chat thread (id, userId, unseenMsgs, chat: UserChatType[]).
- **`ChatDataType`**: Full chat state (profileUser, contacts, chats, activeUser?).

## Redux API for Integration

The chat slice exports the following actions for programmatic control. Use `dispatch(action)` in React components to update state. These are essential for integrating with external libraries like react-chat-widget.

### Available Actions
1. **`getActiveUserData(payload: number)`**
   - Sets the active user by ID.
   - Resets unread message count for the chat.
   - Usage: `dispatch(getActiveUserData(contactId))`
   - Example: Call when selecting a contact in a chat library's UI.

2. **`addNewChat(payload: { id: number })`**
   - Creates a new chat with a contact if it doesn't exist.
   - Adds to `chats` with empty message array.
   - Usage: `dispatch(addNewChat({ id: contactId }))`
   - Example: Trigger before starting a new conversation.

3. **`setUserStatus(payload: { status: StatusType })`**
   - Updates the current user's status.
   - Usage: `dispatch(setUserStatus({ status: 'online' }))`
   - Example: Sync with external status indicators.

4. **`sendMsg(payload: { msg: string })`**
   - Adds a new message to the active chat.
   - Sets sender as current user, adds timestamp and status.
   - Moves chat to the top of the list.
   - Usage: `dispatch(sendMsg({ msg: 'Hello!' }))`
   - Example: Call in response to user input from a chat library.

### Usage in Code
```tsx
import { useDispatch, useSelector } from 'react-redux';
import { getActiveUserData, sendMsg } from '@/redux-store/slices/chat';
import type { RootState } from '@/redux-store';

const MyComponent = () => {
  const dispatch = useDispatch();
  const chatStore = useSelector((state: RootState) => state.chatReducer);

  const handleSend = (message: string) => {
    dispatch(sendMsg({ msg: message }));
  };

  const selectUser = (userId: number) => {
    dispatch(getActiveUserData(userId));
  };

  // Access data: chatStore.chats, chatStore.activeUser, etc.
};
```

## Integration with react-chat

React-chat libraries (e.g., react-chat-widget) provide pre-built UI components for chats. Redux acts as a bridge, managing data while the library handles rendering.

### Steps for Integration
1. **Install Library**: `npm install react-chat-widget` (or similar).
2. **Replace Components**: In `src/views/apps/chat/index.tsx`, replace custom components with the library's widget.
3. **Sync Data**: Use Redux actions to update state, then sync with the library's API (e.g., `addUserMessage`, `addResponseMessage`).
4. **Handle Events**: Map library events (e.g., new message) to Redux dispatches.

### Example Integration (with react-chat-widget)
```tsx
// src/views/apps/chat/index.tsx
import { Widget, addResponseMessage, addUserMessage } from 'react-chat-widget';
import { useDispatch, useSelector } from 'react-redux';
import { sendMsg, getActiveUserData } from '@/redux-store/slices/chat';
import type { RootState } from '@/redux-store';

const Chat = () => {
  const dispatch = useDispatch();
  const chatStore = useSelector((state: RootState) => state.chatReducer);

  // Sync messages when active user changes
  React.useEffect(() => {
    if (chatStore.activeUser) {
      const activeChat = chatStore.chats.find(chat => chat.userId === chatStore.activeUser!.id);
      activeChat?.chat.forEach(msg => {
        if (msg.senderId === chatStore.profileUser.id) {
          addUserMessage(msg.message);
        } else {
          addResponseMessage(msg.message);
        }
      });
    }
  }, [chatStore.activeUser]);

  // Handle new message from react-chat
  const handleNewUserMessage = (newMessage: string) => {
    dispatch(sendMsg({ msg: newMessage }));
    // Optionally sync back: addUserMessage(newMessage);
  };

  // Select user (e.g., from a custom contact list)
  const selectUser = (userId: number) => {
    dispatch(getActiveUserData(userId));
  };

  return (
    <Widget
      handleNewUserMessage={handleNewUserMessage}
      title="Chat"
      subtitle="Talk to your contacts"
    />
  );
};

export default Chat;
```

### Benefits
- Reduces custom UI code.
- Adds features like animations or themes from the library.
- Keeps Redux for logic (e.g., validation, persistence).

### Limitations
- Mock data: For production, integrate with a real backend (e.g., via WebSocket for real-time updates).
- Customization: Libraries may limit styling compared to custom components.
- Extend Redux: Add async thunks for API calls if needed.

## Extending the Chat

- **Real-time Updates**: Add WebSocket (e.g., Socket.io) to dispatch actions on incoming messages.
- **Persistence**: Use localStorage or a database to save chats.
- **New Features**: Add message reactions, file uploads, or group chats by extending types and reducers.
- **Testing**: Use Redux DevTools to inspect state changes.

For questions or custom integrations, refer to the codebase or open an issue.
