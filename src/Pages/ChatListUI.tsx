import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";
import API from "@/lib/axios";
import { BASE_URL } from "@/lib/baseUrl";
import { io } from "socket.io-client";
import Toast from "@/components/custom/toast/Toast";

const socket = io(BASE_URL, {
  withCredentials: true, // ✅ needed if backend expects credentials
});
const ChatList = () => {
  const navigate = useNavigate();
  const [toastMsg, setToastMsg] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);
  // const [selectedUserID] = useState<string | null>(null);
  const [hasJoinedGroup, setHasJoinedGroup] = useState(false);
  // console.log(selectedUserID, "selectedUserID");
  // console.log(contacts);
  const userString = localStorage.getItem("user");
  const user = userString ? JSON.parse(userString) : null;
  // console.log(user)

  const fetchChatList = () => {
    // API.get(`/api/chat/full-chat-list/${user._id}?markRead=false`)
    API.get(`api/chatRouter/conversation/${user._id}`)
      .then((res) => {
        let data = res?.data || [];

        // ✅ Sort by latest message time (descending)
        data.sort((a: any, b: any) => {
          const timeA = new Date(
            a?.lastMsg?.timestamp || a?.lastMessage?.timestamp || 0
          ).getTime();
          const timeB = new Date(
            b?.lastMsg?.timestamp || b?.lastMessage?.timestamp || 0
          ).getTime();
          return timeB - timeA;
        });

        setContacts(data);
        console.log(res?.data, "res?.data?.data");
      })
      .catch((err) => {
        console.error(
          "❌ Error fetching chat list:",
          err.response?.data || err.message
        );
      });
  };

  useEffect(() => {
    if (!user?._id || hasJoinedGroup) return;

    // const groupID = localStorage.getItem("groupID");

    // ✅ Socket join and listeners
    socket.emit("join", { userId: user._id });
    // if(groupID){
    //   socket.emit("joinGroup", { groupId: groupID, userId: user._id });
    // }
    

    socket.on("connect", () => {
      console.log("Connected to socket:", socket.id);
    });
    socket.on("newMessageReceived", (msgPayload) => {
      console.log("📥 newMessageReceived =>", msgPayload);
      fetchChatList(); // ✅ now valid
    });

    socket.on("newGroupCreated", (data) => {
      console.log("🆕 New group created", data.group);
      fetchChatList();
    });

    socket.on("receiveGroupMessage", (msg) => {
      fetchChatList();
      console.log("📨 Group message received:", msg);
      const audio = new Audio("/sounds/new-notification-09-352705.mp3");
      audio
        .play()
        .catch((err) => console.warn("🔇 Autoplay blocked:", err.message));
      setToastMsg(`📨 ${msg?.message || "New group message"}`);
    });

    // socket.on(

    //   "newGroupUnreadMessage",
    //   ({ groupId, from, message, timestamp }) => {
    //     console.log(
    //       "📨 newGroupUnreadMessage →",
    //       groupId,
    //       message,
    //       from,
    //       timestamp
    //     );
    //     fetchChatList();

    //     const audio = new Audio("/sounds/new-notification-09-352705.mp3");
    //     audio
    //       .play()
    //       .catch((err) => console.warn("🔇 Autoplay blocked:", err.message));

    //     setToastMsg(`📨 ${message || "New group message"}`);
    //   }
    // );

    // socket.emit("getUserChats", user._id, (response: any) => {
    //   if (!response) {
    //     console.log("No chat data received from server.");
    //   } else {
    //     console.log("Chats from server:", response);
    //     // You can store them in state if needed
    //   }
    // }
    // );


    fetchChatList();

    return () => {
      socket.off("newUnreadMessage");
      socket.off("newGroupCreated");
      socket.off("newGroupUnreadMessage");
      socket.off("receiveGroupMessage");
      socket.off("unreadCountUpdate"); // ✅ clean up
      // socket.off("groupError");
    };
  }, [user?._id]);

  // ✅ Default fetch on initial render (markRead = true)
  // useEffect(() => {
  //   if (!user?._id) return;

  //   // API.get(`/api/chat/full-chat-list/${user._id}?markRead=false`)
  //   API.get(`api/chatRouter/conversation/${user._id}`)
  //     .then((res) => {
  //       console.log(user._id, "user._id");

  //       // console.log("📥 Initial chat list (markRead=true):", res.data.data);
  //       setContacts(res?.data || []);
  //       console.log(res?.data, "res?.data?.data second");
  //     })
  //     .catch((err) => {
  //       console.error("❌ API Error:", err.response?.data || err.message);
  //     });
  // }, [user?._id]);

  useEffect(()=>{

     socket.on("unreadCountUpdate", ({ conversationId, unreadCount }) => {
      console.log("🔴 unreadCountUpdate1111111111111111111111", conversationId, unreadCount);
      setContacts((prev) => {
        const updated = prev.map((chat) =>
          chat._id === conversationId ? { ...chat, unreadCount } : chat
        );
        return updated.sort((a, b) => {
          const timeA = new Date(a?.lastMsg?.timestamp || a?.lastMessage?.timestamp || 0).getTime();
          const timeB = new Date(b?.lastMsg?.timestamp || a?.lastMessage?.timestamp || 0).getTime();
          return timeB - timeA;
        });
      });
    });
  },[])
 
  const handleSearch = async () => {
    try {
      const res = await API.get(`/api/auth/search?phone_number=${query}`);
      if (res.data?.result) {
        setSearchResult(res.data.result);
        setNotFound(false);
      } else {
        setSearchResult(null);
        setNotFound(true);
      }
    } catch {
      setSearchResult(null);
      setNotFound(true);
    }
  };

  const handleSelect = () => {
    if (searchResult) {
      console.log(searchResult._id);
      navigate(`/chat/${searchResult._id}`);
    }
  };

  const renderChatCard = (item: any) => {
    console.log(item);
    const isGroup = item.type === "group";
    const displayName = isGroup ? item.user.userName : item.user.userName;
    const initials = displayName?.[0] || "?";
 const lastMsg = item?.lastMsg?.message || item?.lastMessage?.message || "";
    // const lastSeen = !item.online ? item.last_seen : "";
    const unread = item?.unreadCount > 0;
    console.log(item?.unreadCount, "unreadcount");

    return (
      <div
        key={item._id}
        // onClick={async () => {
        //   // try {
        //   //   let response;

        //   //   if (item.type === "group") {
        //   //     // 👥 Group Chat
        //   //     response = await API.post(`/api/chat/markRead/${user._id}/${item._id}`);
        //   //   } else {
        //   //     // 👤 Personal Chat
        //   //     response = await API.post(`/api/chat/markRead/${user._id}`, {
        //   //       groupId: null,
        //   //       chatId: item._id,
        //   //     });
        //   //   }

        //   //   console.log("✅ Mark Read Response:", response.data);
        //   // } catch (err) {
        //   //   console.error("❌ Failed to mark chat as read", err);
        //   // }

        //   navigate(`/chat/${item._id}`, {
        //     state: { type: item.type, participants: item.participants },
        //   });
        // }}
        onClick={async () => {
          // ✅ Mark as read
          if (item.type === "group") {
            socket.emit("markGroupMessagesRead", {
              userId: user._id,
              groupId: item._id,
            });
          } else {
            const otherUserId = item.user?._id;
            socket.emit("markMessagesRead", { userId: user._id, otherUserId });
          }

          navigate(`/chat/${item._id}`, {
            state: { type: item.type, participants: item.participants },
          });
        }}
        className="flex items-center gap-3 p-3 rounded hover:bg-muted cursor-pointer transition"
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
          ${
            isGroup
              ? "bg-green-500 dark:bg-green-700"
              : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{displayName}</div>
          <div className="text-xs text-gray-500 truncate">{lastMsg}</div>
        </div>
        {unread && (
          <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {item?.unreadCount}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col md:flex-row bg-white dark:bg-black my-16">
      <div className="w-full   border-r border-gray-200 dark:border-gray-800">
        {/* Search */}
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter phone number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Search
            </button>
          </div>
          {toastMsg && (
            <Toast message={toastMsg} onClose={() => setToastMsg("")} />
          )}
          {searchResult && (
            <div className="bg-white dark:bg-gray-900 mt-3 p-3 rounded border">
              <p className="font-semibold text-green-700">✅ User Found:</p>
              <p>Name: {searchResult.userName}</p>
              <p>Phone: {searchResult.phone_number}</p>
              <button
                onClick={handleSelect}
                className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Select
              </button>
            </div>
          )}

          {notFound && (
            <div className="mt-2 bg-red-100 text-red-700 px-3 py-2 rounded">
              ❌ No user found.
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="h-full flex flex-col">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>

          {/* All */}
          <TabsContent value="all">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2 space-y-2">
              <div className="text-xs font-semibold text-gray-500 px-2">
                Chats
              </div>
              {contacts.length > 0 && contacts.map(renderChatCard)}
            </div>
          </TabsContent>

          {/* Groups */}
          <TabsContent value="groups">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2 space-y-2">
              <div className="text-xs font-semibold text-gray-500 px-2">
                Groups
              </div>
              {contacts.filter((c) => c.type === "group").map(renderChatCard)}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Group Button */}
      <div className="w-full fixed bottom-4 px-4 py-2 flex justify-end z-50">
        <button
          onClick={() => navigate("/creategroup")}
          className="px-4 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          + Add Group
        </button>
      </div>
    </div>
  );
};

export default ChatList;
