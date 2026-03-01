import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getISTDate() {
  const now = new Date();
  // Add 5 hours and 30 minutes to the UTC time
  const offset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + offset);
  // Returning with 'Z' ensures the DB stores these exact digits as the timestamp
  return istDate.toISOString();
}
