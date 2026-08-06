// src/features/members/components/MemberAvatar.tsx

import { Box } from '@mui/material';

// Define what fields we actually need
interface AvatarFields {
  initial: string;
  color: string;
  org_admin?: boolean;
}

// Generic component that accepts any type that has the required fields
export function MemberAvatar<T extends AvatarFields>({ member }: { member: T }) {
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        bgcolor: member.color || '#4F46E5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: (theme) => theme.palette.getContrastText(member.color || '#4F46E5'),
        fontWeight: 'bold',
        fontSize: '0.875rem',
        boxShadow: member.org_admin
          ? '0 0 0 3px gold, 0 0 0 6px rgba(255, 215, 0, 0.2), 0 0 12px 8px rgba(255, 215, 0, 0.1)'
          : 'none',
      }}
    >
      {member.initial}
    </Box>
  );
}

// Usage:
// <MemberAvatar member={member} />      // Works with Member
// <MemberAvatar member={resolvedMember} /> // Works with ResolvedMember