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
            hasSyncedRef.current = false;
        }
    });

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            hasSyncedRef.current = false;
        }
    }, [isLoaded, isSignedIn]);

    useEffect(()=>{

        if (isLoaded && isSignedIn && !hasSyncedRef.current && !syncUserMutation.isPending) {
            syncUserMutation.mutate();
        }
    }, [isLoaded, isSignedIn, syncUserMutation.isPending]);
    
    return null;
}; 