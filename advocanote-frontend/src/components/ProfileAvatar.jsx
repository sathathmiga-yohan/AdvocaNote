
import React, {
  useEffect,
  useState,
} from "react";

import {
  getMyProfilePhoto,
} from "../services/profileApi";

// =====================================
// SHARED PROFILE PHOTO CACHE
// =====================================

const photoCache = new Map();

function getPhotoCache(userId) {
  if (!photoCache.has(userId)) {
    photoCache.set(userId, {
      url: "",
      loaded: false,
      promise: null,
      version: 0,
    });
  }

  return photoCache.get(userId);
}

function fetchSharedPhoto(userId, force = false) {
  const cache = getPhotoCache(userId);

  if (!force && cache.loaded) {
    return Promise.resolve(cache.url);
  }

  if (!force && cache.promise) {
    return cache.promise;
  }

  const version = ++cache.version;

  const promise = getMyProfilePhoto()
    .then((blob) => {
      const nextUrl = blob
        ? URL.createObjectURL(blob)
        : "";

      // Ignore an outdated request.
      if (version !== cache.version) {
        if (nextUrl) {
          URL.revokeObjectURL(nextUrl);
        }

        return cache.url;
      }

      const previousUrl = cache.url;

      cache.url = nextUrl;
      cache.loaded = true;

      // Give React time to display the new photo.
      if (previousUrl && previousUrl !== nextUrl) {
        setTimeout(() => {
          URL.revokeObjectURL(previousUrl);
        }, 3000);
      }

      return nextUrl;
    })
    .finally(() => {
      if (cache.promise === promise) {
        cache.promise = null;
      }
    });

  cache.promise = promise;

  return promise;
}

// =====================================
// PROFILE AVATAR COMPONENT
// =====================================

export default function ProfileAvatar({
  user,
  size = 44,
}) {
  const userId =
    user?.id != null
      ? String(user.id)
      : null;

  const [photoUrl, setPhotoUrl] = useState(
    () => (
      userId
        ? getPhotoCache(userId).url
        : ""
    )
  );

  const fullName =
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    "Lawyer";

  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "L";

  useEffect(() => {
    if (!userId) {
      setPhotoUrl("");
      return;
    }

    let active = true;
    let requestNumber = 0;

    // Show cached photo immediately.
    setPhotoUrl(getPhotoCache(userId).url);

    async function loadPhoto(force = false) {
      const currentRequest = ++requestNumber;

      try {
        const url = await fetchSharedPhoto(
          userId,
          force
        );

        if (
          active &&
          currentRequest === requestNumber
        ) {
          setPhotoUrl(url);
        }
      } catch (error) {
        if (
          active &&
          currentRequest === requestNumber
        ) {
          console.error(
            "Unable to load profile photo:",
            error
          );

          setPhotoUrl(
            getPhotoCache(userId).url
          );
        }
      }
    }

    loadPhoto();

    // Reload only when photo is updated/removed.
    const onPhotoChanged = () => {
      loadPhoto(true);
    };

    window.addEventListener(
      "advocanote:profile-photo-changed",
      onPhotoChanged
    );

    return () => {
      active = false;
      requestNumber++;

      window.removeEventListener(
        "advocanote:profile-photo-changed",
        onPhotoChanged
      );
    };
  }, [userId]);

  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        background:
          "linear-gradient(145deg, #ffedbf, #efc77c)",
        color: "#3b2a12",
        fontFamily: "Georgia, serif",
        fontWeight: 700,
        fontSize: size * 0.32,
      }}
      aria-label={`${fullName} profile photo`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
}
