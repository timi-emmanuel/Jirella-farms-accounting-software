import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function roundTo2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}
