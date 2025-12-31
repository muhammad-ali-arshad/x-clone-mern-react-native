import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@clerk/clerk-expo";

import { useApiClient, userApi } from "@/utils/api";


export const useUserSync = ()=>{
    const {isSignedIn, isLoaded} = useAuth();
    const api = useApiClient();
    const hasSyncedRef = useRef(false);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const syncUserMutation = useMutation({
        mutationFn: () => userApi.syncUser(api),
        retry: (failureCount, error: any) => {
            const status = error?.response?.status;
            // Don't retry on client errors (4xx) - these are permanent
            if (status >= 400 && status < 500) {
                return false;
            }
            // Retry up to 3 times on 500 errors or network errors
            if ((status === 500 || !status) && failureCount < 3) {
                console.log(`🔄 Retrying user sync (attempt ${failureCount + 1}/3)...`);
                return true;
            }
            return false; // Don't retry on other errors
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Max 10s delay
        onSuccess: (response: any) => {
            console.log("✅ User synced successfully: ", response.data.message);
            hasSyncedRef.current = true;
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        },
        onError:(error: any) => {
            const status = error?.response?.status;
            const errorMessage = error?.response?.data?.error || error?.message;
            
            console.error("❌ User sync failed:", {
                status,
                error: errorMessage,
            });
            
            // Don't set hasSyncedRef to false on error - allow retry
            // Only set to false if it's a permanent error (not 500)
            if (status && status !== 500 && status !== 0) {
                // Permanent error (like 401, 404) - don't retry automatically
                hasSyncedRef.current = false;
            }
            // For 500 errors, let the retry mechanism handle it
        }
    });

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            hasSyncedRef.current = false;
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        }
    }, [isLoaded, isSignedIn]);

    useEffect(()=>{
        // Only sync if: user is loaded, signed in, not already synced, and not currently syncing
        if (isLoaded && isSignedIn && !hasSyncedRef.current && !syncUserMutation.isPending) {
            syncUserMutation.mutate();
        }
    }, [isLoaded, isSignedIn, syncUserMutation.isPending]);
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);
    
    return null;
}; 