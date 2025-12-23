export const protectRoute = async(req , res, next)=>{
    if (!res.auth().isAuthenticated) {
        return res.status(401).json({message:"UNAUTHORIZED- you must be logged in"})

    }
    next();
}