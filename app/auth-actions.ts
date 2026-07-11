"use server";

import { redirect } from "next/navigation";
import { signInDashboard } from "@/lib/dashboard-auth";

export async function loginDashboard(formData: FormData) {
  const token = formData.get("accessToken");
  const valid = await signInDashboard(typeof token === "string" ? token : "");

  if (!valid) {
    redirect("/login?error=invalid");
  }

  redirect("/");
}
