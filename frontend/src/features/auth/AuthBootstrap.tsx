import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetMeQuery } from './authApi';
import { setUser, clearUser, setAuthInitialized } from './authSlice';
import type { RootState } from '../../app/store';

export const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { isInitialized } = useSelector((state: RootState) => state.auth);
  const { data, isError, isSuccess } = useGetMeQuery(undefined, { skip: isInitialized });

  useEffect(() => {
    if (!isSuccess || !data) return;

    dispatch(setUser({
      id: data.id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      locale: data.locale,
    }));
  }, [data, dispatch, isSuccess]);

  useEffect(() => {
    if (!isError) return;

    dispatch(clearUser());
    dispatch(setAuthInitialized(true));
  }, [dispatch, isError]);

  return children;
};
