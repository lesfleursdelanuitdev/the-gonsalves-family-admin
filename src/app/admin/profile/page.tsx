"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import {
  useMyProfile,
  useUpdateMyProfile,
  useUpdateMyAccount,
  useChangeMyPassword,
} from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/infra/api";
import { Eye, EyeOff, KeyRound, LogOut, Save } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

export default function AdminProfilePage() {
  const { data: user } = useCurrentUser();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const updateAccount = useUpdateMyAccount();
  const changePassword = useChangeMyPassword();
  const logout = useLogout();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordClientError, setPasswordClientError] = useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);

  const touchPasswordFields = useCallback(() => {
    setPasswordSuccessMessage(null);
    changePassword.reset();
  }, [changePassword]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
      setLocation(profile.location ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      setAccountName(user.name ?? "");
      setAccountEmail(user.email ?? "");
    }
  }, [user]);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ displayName, bio, location });
  };

  const handleAccountSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccount.mutate({ name: accountName, email: accountEmail });
  };

  const handlePasswordSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordClientError(null);
    changePassword.reset();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordClientError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordClientError("New password and confirmation do not match.");
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmNewPassword("");
          setPasswordSuccessMessage("Password updated. Use it the next time you sign in.");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Logged in as <span className="font-medium">{user?.username}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>

      {/* Public profile */}
      <Card>
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          <CardDescription>Visible to other users based on your privacy settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <Button size="sm" disabled={updateProfile.isPending}>
              <Save className="size-4" />
              {updateProfile.isPending ? "Saving..." : "Save profile"}
            </Button>
            {updateProfile.isSuccess && (
              <p className="text-sm text-green-600">Profile saved.</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Account settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Update the name and email stored on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccountSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} />
            </div>
            <Button size="sm" disabled={updateAccount.isPending}>
              <Save className="size-4" />
              {updateAccount.isPending ? "Saving..." : "Save account"}
            </Button>
            {updateAccount.isSuccess && (
              <p className="text-sm text-green-600">Account updated.</p>
            )}
            {updateAccount.error && (
              <p className="text-sm text-destructive">{updateAccount.error.message}</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card id="change-password">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle>Password</CardTitle>
          </div>
          <CardDescription>
            Change the password you use to sign in. You must enter your current password. Nothing is sent by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => {
                    touchPasswordFields();
                    setCurrentPassword(e.target.value);
                  }}
                  className="pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 z-[1] -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowCurrentPassword((p) => !p)}
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    touchPasswordFields();
                    setNewPassword(e.target.value);
                  }}
                  className="pr-12"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 z-[1] -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowNewPassword((p) => !p)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    touchPasswordFields();
                    setConfirmNewPassword(e.target.value);
                  }}
                  className="pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 z-[1] -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {(passwordClientError || changePassword.error) && (
              <p className="text-sm text-destructive" role="alert">
                {passwordClientError ??
                  (changePassword.error instanceof ApiError
                    ? changePassword.error.message
                    : changePassword.error instanceof Error
                      ? changePassword.error.message
                      : "Could not change password.")}
              </p>
            )}
            <Button size="sm" type="submit" disabled={changePassword.isPending}>
              <KeyRound className="size-4" />
              {changePassword.isPending ? "Updating…" : "Change password"}
            </Button>
            {passwordSuccessMessage ? (
              <p className="text-sm text-green-600">{passwordSuccessMessage}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
