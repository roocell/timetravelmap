type UserAccessShape = {
  isRestricted?: boolean;
} | null | undefined;

export function canAccessApp(user: UserAccessShape) {
  if (!user) {
    return false;
  }

  return user.isRestricted === false;
}
