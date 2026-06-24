import { useGetUserQuery } from "../features/users/usersApi";
import type { LocaleCode } from '../shared/constants/locales';

export const useUserLocale = (userId: number) => {
  const { data: user } = useGetUserQuery(userId);

  const userLocale = (user?.locale ?? ['en'])

  return {
    userLocale: (userLocale ?? 'en') as LocaleCode,
  };
};