
import { useEffect, useState } from "react";

export default function useAdminUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    const API_URL = (
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");

    const fetchCount = async () => {
      const token =
        localStorage.getItem("advocanote_access_token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("advocanote_access_token") ||
        localStorage.getItem("access_token");

      if (!token) {
        if (active) setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/admin/notifications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (active) {
          setUnreadCount(
            (data.items || []).filter(
              (item) => !item.is_read
            ).length
          );
        }
      } catch (error) {
        console.error(
          "Admin notification count error:",
          error
        );
      }
    };

    fetchCount();

    const interval = setInterval(fetchCount, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return unreadCount;
}
