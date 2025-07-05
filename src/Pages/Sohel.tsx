import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import API from "@/lib/axios";
import { BASE_URL } from "@/lib/baseUrl";
import Toast from "@/components/custom/toast/Toast";
import { useNavigate } from "react-router-dom";
import socket from "@/socket";

type Message = {
  conversationId: any;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  payload?: any;
};
interface GenerateConversationId {
  (mobile1: string, mobile2: string): string;
}
const SohelChatBox = ({
  currentUserId,
  otherUserId,
}: {
  currentUserId: string;
  otherUserId: string;
}) => {
  console.log(currentUserId);
  console.log(otherUserId);
  const navigate = useNavigate();
  const [toastMsg, setToastMsg] = useState("");

  const [matchedChat, setMatchedChat] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const socketRef = useRef(io(BASE_URL, { forceNew: true }));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const generateConversationId: GenerateConversationId = (mobile1, mobile2) => {
    const sorted = [mobile1, mobile2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  };
  const conversationId = generateConversationId("9981443156", "9977679355");
  console.log(conversationId);
  useEffect(() => {
    if (!currentUserId || !otherUserId || !conversationId) return;

    API.post(
      `api/chatRouter/chat/markRead/${currentUserId}/${conversationId}`
    ).catch(() => console.error("❌ Failed to mark chat as read"));
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    if (!currentUserId || !otherUserId || !conversationId) return;

    // API.get(`/api/chat/full-chat-list/${currentUserId}`)
    API.get(`/api/chatRouter/messages/${conversationId}`)
      .then((res) => {
        const chats = res?.data?.data || [];
        setContacts(chats);

        const matched = chats.find((chat: any) => {
          if (chat.type === "group") return false;
          return chat._id === otherUserId;
        });

        setMatchedChat(matched || null);
      })
      .catch(console.error);
  }, [currentUserId, otherUserId]);

  const formatLastSeen = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return `last seen today at ${time}`;
    if (isYesterday) return `last seen yesterday at ${time}`;

    const formattedDate = date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
    });
    return `last seen on ${formattedDate} at ${time}`;
  };

  useEffect(() => {
    const socket = socketRef.current;

    socket.emit("userOnline", currentUserId);
    socket.emit("joinConversation", conversationId);
    socket.emit("join", { userId: currentUserId });

    API.get(`/api/chatRouter/messages/${conversationId}`)
      .then((res) => {
        setMessages(res?.data.data);
      })
      .catch(console.error);
    // API.get(`/api/chat/messages/${conversationId}`)
    //   .then((res) => {
    //     console.log(res)
    //     setMessages(res?.data);
    //   })
    //   .catch(console.error);
    // API.get(`/api/chat/conversation/${ userId }`)
    //  API.get(`/api/chat/messages/${currentUserId}/${otherUserId}`)
    API.get(`/api/chatRouter/messages/${conversationId}`)
      .then((res) => {
        console.log(res.data);
        setMessages(res?.data);
      })
      .catch(console.error);

    const handleReceive = (msg: Message) => {
      if (msg.senderId === otherUserId) {
        const audio = new Audio("/sounds/new-notification.mp3");
        audio
          .play()
          .catch(() => console.warn("🔇 Notification sound blocked."));
        setToastMsg(`📨 ${msg.message}`);

        API.post(
          `api/chatRouter/chat/markRead/${currentUserId}/${conversationId}`
        ).catch(() => console.error("❌ Failed to mark chat as read"));
      }

      setMessages((prev) => [...prev, msg]);
    };

    socket.on("newMessageReceived", handleReceive);

    return () => {
      socket.off("newMessageReceived", handleReceive);
    };
  }, [currentUserId, otherUserId, conversationId]);

  useEffect(() => {
    const socket = socketRef.current;

    // ✅ Message delivered to receiver
    socket.on("messageDelivered", ({ messageId, to, conversationId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, status: "delivered" } : msg
        )
      );
    });
    console.log("messagesReadByyyyyyyyyyyyyyyyyyyyyyyyyyyy");

    // ✅ Message read by receiver
    socket.on("messagesReadBy", ({ from, conversationId }) => {
      console.log("🟢 Message Read Event", from, conversationId);
      setMessages((prevMsgs) =>
        prevMsgs.map((msg) =>
          msg.senderId === currentUserId &&
          msg.conversationId === conversationId
            ? { ...msg, status: "read" }
            : msg
        )
      );
      setContacts((prevContacts) =>
        prevContacts.map((chat) =>
          chat._id === conversationId
            ? {
                ...chat,
                lastMessage: {
                  ...chat.lastMessage,
                  status: "read",
                },
              }
            : chat
        )
      );
    });

    socket.on("unreadCountUpdate", ({ conversationId, unreadCount }) => {
      setContacts((prev) =>
        prev.map((chat) =>
          chat._id === conversationId ? { ...chat, unreadCount } : chat
        )
      );
    });
    socket.emit("markMessagesRead", {
      userId: currentUserId,
      conversationId: conversationId,
    });

    return () => {
      socket.off("unreadCountUpdate");
      socket.off("messageDelivered");
      socket.off("messagesReadBy");
      socket.off("markMessagesRead");
    };
  }, [conversationId, currentUserId, socket]);

  useEffect(scrollToBottom, [messages]);

  // useEffect(() => {
  //   if (!currentUserId) return;
  //  console.log(currentUserId,"currentUserId");

  //   const markChatAsRead = async () => {
  //     try {
  //       await API.post(`/api/chat/markRead/${currentUserId}`);
  //     } catch (err) {
  //       console.error("❌ Failed to mark chat as read",err);
  //     }
  //   };

  //   markChatAsRead();
  // }, [currentUserId]);

  //   socket.emit('sendMessage', {
  //   senderId: userId,
  //   receiverId: otherUserId,
  //   message: 'Hello!',
  //   messageType: 'text',
  //   payload: {},
  //   conversationId: conversationId,  // Or let backend create if first time
  //   type: '1on1'
  // });

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    console.log(conversationId);
    const tempId = `${Date.now()}-${Math.random()}`;

    const msg = {
      type: "1on1",
      senderId: currentUserId,
      receiverId: otherUserId,
      message: newMessage,
      messageType: "text",
      conversationId: conversationId,
      payload: {},
      timestamp: new Date().toISOString(),
      status: "sent", // local status
      _id: tempId, // temporary ID until response
    };

    socketRef.current.emit("sendMessage", {
      ...msg,
      conversationId,
      type: "1on1",
    });

    // setMessages((prev) => [...prev, msg]);
    setNewMessage("");
  };

  // ✅ Call Initiation
  const initiateCall = (isVideo: boolean) => {
    const socket = socketRef.current;

    socket.emit("startCall", {
      fromUserId: currentUserId,
      toUserId: otherUserId,
      isVideo,
    });

    navigate(isVideo ? "/videocall" : "/audiocall", {
      state: {
        callerId: currentUserId,
        receiverId: otherUserId,
        incoming: false,
        isVideo,
      },
    });
  };

  // ✅ Handle Incoming Call
  useEffect(() => {
    const socket = socketRef.current;

    socket.on("incomingCall", ({ fromUserId, isVideo }) => {
      console.log("📞 Incoming Call from:", fromUserId);

      const ringtone = new Audio("/sounds/ringtone.mp3");
      ringtone.loop = true;
      ringtone.play().catch(() => console.warn("🔇 Ringtone autoplay blocked"));

      const confirmCall = window.confirm(
        `${isVideo ? "Video" : "Audio"} call from ${fromUserId}. Accept?`
      );

      if (confirmCall) {
        ringtone.pause();
        navigate(isVideo ? "/videocall" : "/audiocall", {
          state: {
            callerId: fromUserId,
            receiverId: currentUserId,
            incoming: true,
            isVideo,
          },
        });
      } else {
        ringtone.pause();
        socket.emit("callDeclined", { toUserId: fromUserId });
      }
    });

    return () => {
      socket.off("incomingCall");
    };
  }, [currentUserId]);

  return (
    <div className="flex flex-col h-screen max-w-md w-full mx-auto bg-white dark:bg-black border rounded shadow-md my-16 relative">
      {/* Header */}
      <div className="flex justify-between fixed top-16 left-1/2 transform -translate-x-1/2 w-full max-w-md z-30 bg-blue-600 text-white font-semibold text-lg p-4 border-b">
        <div>
          <div>{matchedChat?.userName}</div>
          <div className="text-xs text-white/80 font-normal">
            {!matchedChat?.online && matchedChat?.last_seen
              ? formatLastSeen(matchedChat.last_seen)
              : "online"}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => initiateCall(true)}>📹 Video</button>
          <button onClick={() => initiateCall(false)}>🎧 Audio</button>
        </div>
      </div>

      {/* Messages */}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg("")} />}
      <div className="flex-1 overflow-y-auto pt-[88px] pb-24 px-4 space-y-2 bg-gray-100 dark:bg-gray-800">
        {messages?.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm text-sm ${
              msg.senderId === currentUserId
                ? "ml-auto bg-blue-500 text-white"
                : "mr-auto bg-gray-500 text-black"
            }`}
          >
            <p>{msg.message}</p>
            <div className="text-[10px] text-right text-white/70 dark:text-gray-400 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}

              {/* ✅ Status Ticks */}
              {msg.senderId === currentUserId && (
                <div className="ml-2">
                  {msg.status === "sent" && <span>✓</span>}
                  {msg.status === "delivered" && <span>✓</span>}
                  {msg.status === "read" && <span>✓✓</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="w-full px-2 py-2 bg-white dark:bg-gray-900 border-t flex items-center gap-2 fixed bottom-0 max-w-md">
        <input
          type="text"
          className="flex-1 p-2 border rounded-full focus:outline-none text-sm"
          placeholder="Type a message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default SohelChatBox;
