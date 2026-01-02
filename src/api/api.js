import axiosConfig from "../config/axiosConfig"


export const registerUserApi = async (userData)=>{
    try {
        const response = await axiosConfig.post("/api/user/auth/register",userData)
        return response.data
    } catch (error) {
        throw error;
    }
}

export const loginUserApi = async (userData)=>{
    try {
        const response = await axiosConfig.post("/api/user/auth/login",userData)
        return response.data
    } catch (error) {
        throw error;
    }
}