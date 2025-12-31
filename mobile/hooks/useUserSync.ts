import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@clerk/clerk-expo";

import { useApiClient, userApi } from "@/utils/api";


export const useUserSync = ()=>{
    const {isSignedIn, isLoaded} = useAuth();
    const api = useApiClient();
    const hasSyncedRef = useRef(false);
    const hasAttemptedRef = useRef(false);
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 2; // Maximum 2 retries (3 total attempts)
    
    const syncUserMutation = useMutation({
        mutationFn: () => userApi.syncUser(api),
        retry: false, // Disable react-query retry - we handle it manually
        onSuccess: (response: any) => {
            console.log("✅ User synced successfully: ", response.data?.message || "User synced");
            hasSyncedRef.current = true;
            hasAttemptedRef.current = true;
            retryCountRef.current = 0; // Reset retry count on success
        },
        onError:(error: any) => {
            const status = error?.response?.status;
            const errorMessage = error?.response?.data?.error || error?.message;
            
            console.error("❌ User sync failed:", {
                status,
                error: errorMessage,
                attempt: retryCountRef.current + 1,
            });
            
            // Don't retry on client errors (4xx) - these are permanent
            if (status >= 400 && status < 500) {
                hasAttemptedRef.current = true;
                hasSyncedRef.current = false;
                retryCountRef.current = 0;
                return; // Stop retrying on permanent errors
            }
            
            // For 500 errors or network errors, allow manual retry up to MAX_RETRIES
            if ((status === 500 || !status) && retryCountRef.current < MAX_RETRIES) {
                retryCountRef.current += 1;
                // Retry after exponential backoff
                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
                console.log(`🔄 Will retry user sync in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES + 1})...`);
                
                setTimeout(() => {
                    // Only retry if still signed in and not already synced
                    if (isSignedIn && !hasSyncedRef.current && !syncUserMutation.isPending) {
                        syncUserMutation.mutate();
                    }
                }, delay);
            } else {
                // Max retries reached or other error
                hasAttemptedRef.current = true;
                retryCountRef.current = 0;
            }
        }
    });

    // Reset sync state when user signs out
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            hasSyncedRef.current = false;
            hasAttemptedRef.current = false;
            retryCountRef.current = 0;
        }
    }, [isLoaded, isSignedIn]);

    // Only sync once when user is loaded and signed in
    useEffect(()=>{
        // Only sync if: user is loaded, signed in, not already synced, not currently syncing, and haven't attempted yet
        if (
            isLoaded && 
            isSignedIn && 
            !hasSyncedRef.current && 
            !hasAttemptedRef.current &&
            !syncUserMutation.isPending
        ) {
            console.log("🔄 Starting user sync...");
            syncUserMutation.mutate();
        }
    }, [isLoaded, isSignedIn]); // Only depend on auth state, not mutation state
    
    return null;
}; 