import { useCallback, useEffect, useMemo, useState } from "react";
import { getUser } from "../utils/auth";
import { apiReminders } from "../utils/api";

export default function useUnreadMessages() {
  const user = getUser();
  const storageKey = user ? `read-msg-ids:${user.id}` : "read-msg-ids:anon";
  const [messages, setMessages] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch {
      return new Set();
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiReminders.listMy(); // { items: [...] }
      setMessages(data?.items || []);
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(readIds)));
  }, [storageKey, readIds]);

  const markAsRead = useCallback((id) => {
    setReadIds((prev) => new Set(prev).add(id));
  }, []);

  const unreadCount = useMemo(
    () => messages.filter((m) => !readIds.has(m.id)).length,
    [messages, readIds]
  );

  return { messages, unreadCount, markAsRead, refresh, loading, error, readIds };
}
