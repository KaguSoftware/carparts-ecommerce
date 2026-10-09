"use server";

import { createStaffUser, deleteUser, sendPasswordReset, setUserDisabled, setUserRole } from "@/lib/services/users-admin";
import { adminAction, refresh } from "./_shared";
import { createStaffSchema, setDisabledSchema, setRoleSchema, userIdSchema } from "./users.schema";

const PATHS = ["/admin/staff", "/admin/customers"];

export async function createStaffAction(raw: unknown) {
  return adminAction("users.manage", createStaffSchema, raw, async (input, { actor }) => {
    const user = await createStaffUser(input, actor);
    refresh(PATHS);
    return { id: user.id };
  });
}

export async function setUserRoleAction(raw: unknown) {
  return adminAction("users.manage", setRoleSchema, raw, async ({ id, role }, { actor }) => {
    await setUserRole(id, role, actor);
    refresh([...PATHS, `/admin/customers/${id}`]);
  });
}

export async function setUserDisabledAction(raw: unknown) {
  return adminAction("users.manage", setDisabledSchema, raw, async ({ id, disabled }, { actor }) => {
    await setUserDisabled(id, disabled, actor);
    refresh([...PATHS, `/admin/customers/${id}`]);
  });
}

export async function sendPasswordResetAction(raw: unknown) {
  return adminAction("users.manage", userIdSchema, raw, async ({ id }, { actor }) => {
    await sendPasswordReset(id, actor);
  });
}

export async function deleteUserAction(raw: unknown) {
  return adminAction("users.manage", userIdSchema, raw, async ({ id }, { actor }) => {
    await deleteUser(id, actor);
    refresh(PATHS);
  });
}
