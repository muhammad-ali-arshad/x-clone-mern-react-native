import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@clerk/clerk-expo";

import { useApiClient, userApi } from "@/utils/api";


export const useUserSync = ()=>{
    const {isSignedIn, isLoaded} = useAuth();
    const api = useApiClient();
    const hasSyncedRef = useRef(false);
    
    const syncUserMutation = useMutation({
        mutationFn: () => userApi.syncUser(api),
        onSuccess: (response: any) => {
            console.log("User synced successfully: ", response.data.message);
            hasSyncedRef.current = true;
        },
        onError:(error: any) => {
            console.error("User sync failed:", error);
            // Reset ref on error so we can retry if needed
            hasSyncedRef.current = false;
        }
    });

    // Reset sync ref when user signs out
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            hasSyncedRef.current = false;
        }
    }, [isLoaded, isSignedIn]);

    useEffect(()=>{
        // Only sync if:
        // 1. Auth is loaded
        // 2. User is signed in
        // 3. We haven't synced yet (or previous sync failed)
        // 4. Mutation is not currently in progress
        if (isLoaded && isSignedIn && !hasSyncedRef.current && !syncUserMutation.isPending) {
            syncUserMutation.mutate();
        }
    }, [isLoaded, isSignedIn, syncUserMutation.isPending]);
    
    return null;
}; 