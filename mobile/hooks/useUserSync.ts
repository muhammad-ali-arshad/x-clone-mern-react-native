import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@clerk/clerk-expo";

import { useApiClient, userApi } from "@/utils/api";


export const useUserSync = ()=>{
    const {isSignedIn, isLoaded} = useAuth();
    const api = useApiClient();
    const hasSyncedRef = useRef(false);
    const hasAttemptedRef = useRef(false);
    const syncTriggeredRef = useRef(false); // Prevent multiple triggers
    
    const syncUserMutation = useMutation({
        mutationFn: () => userApi.syncUser(api),
        retry: false, // CRITICAL: Disable ALL automatic retries
        onSuccess: (response: any) => {
            console.log("✅ User synced successfully: ", response.data?.message || "User synced");
            hasSyncedRef.current = true;
            hasAttemptedRef.current = true;
        },
        onError:(error: any) => {
            const status = error?.response?.status;
            const errorMessage = error?.response?.data?.error || error?.message;
            
            console.error("❌ User sync failed (no retries):", {
                status,
                error: errorMessage,
            });
            
            // Mark as attempted - NEVER retry automatically
            hasAttemptedRef.current = true;
            hasSyncedRef.current = false;
            
            // Log error but don't crash the app
            // User can manually retry if needed
        }
    });

    // Reset sync state when user signs out
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            hasSyncedRef.current = false;
            hasAttemptedRef.current = false;
            syncTriggeredRef.current = false;
        }
    }, [isLoaded, isSignedIn]);

    // CRITICAL: Only sync ONCE per authenticated session - prevent infinite loops
    useEffect(()=>{
        // Only sync if ALL conditions are met:
        // 1. Auth is loaded
        // 2. User is signed in
        // 3. Not already synced
        // 4. Haven't attempted yet
        // 5. Not currently syncing
        // 6. Haven't triggered sync in this session
        if (
            isLoaded && 
            isSignedIn && 
            !hasSyncedRef.current && 
            !hasAttemptedRef.current &&
            !syncUserMutation.isPending &&
            !syncTriggeredRef.current
        ) {
            syncTriggeredRef.current = true; // Prevent re-trigger
            console.log("🔄 Starting user sync (one-time)...");
            syncUserMutation.mutate();
        }
    }, [isLoaded, isSignedIn]); // Only depend on auth state - NEVER on mutation state
    
    return null;
}; 