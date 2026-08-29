import React, { useState, type ChangeEvent } from 'react';
import {
  Box,
  Avatar,
  Typography,
  TextField,
  Button,
  Stack,
} from '@mui/material';
import { useInitUserQuery, useUpdateUserByUUIDMutation } from '../../redux/api/auth';
import { getOrCreateUserId } from '../../lib/helper';

const UserProfileDrawer: React.FC = () => {
  // Mock initial values (later fetched from API/context)
  const initialName = 'Guest user';
  const initialEmail = '';

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  // Track if changes were made
  const userUID = getOrCreateUserId()

  const { data } = useInitUserQuery(userUID)
  const hasChanges = name !== (data?.userName || initialName) || email !== (data?.email || initialEmail);

  React.useEffect(()=> {
    if (!data) return
    setName(data.userName ?? initialName)
    setEmail(data.email ?? initialEmail)
  }, [data])


  const [updateMethod] = useUpdateUserByUUIDMutation()
  const handleSave = () => {
    // TODO: connect to API
    if (name==="") return;
    updateMethod({ uuid: userUID, userName:name })
  };

  const handleAvatarClick = () => {
    // TODO: open file picker later
    console.log('Change avatar clicked');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3} alignItems="center">
        {/* Avatar */}
        <Avatar
          sx={{
            width: 96,
            height: 96,
            cursor: 'pointer',
          }}
          onClick={handleAvatarClick}
        >
          {name.charAt(0).toUpperCase()}
        </Avatar>

        <Typography variant="body2" color="text.secondary">
          Click avatar to change
        </Typography>

        {/* Name */}
        <TextField
          label="Nickname"
          fullWidth
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
        />

        {/* Email (optional) */}
        <TextField
          label="Email (optional)"
          type="email"
          fullWidth
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
        />

        {/* Save Button */}
        {hasChanges && name!=="" && (
          <Button
            variant="contained"
            fullWidth
            onClick={handleSave}
          >
            Save Changes
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default UserProfileDrawer;
