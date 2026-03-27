import e from "express";

export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ authMiddleware

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Lỗi khi gọi authMe", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
    // return res.status(200).json({message: "Đây là route authMe, bạn đã xác thực thành công!"});

};

export const test = async (req, res) => {
  return res.sendStatus(204); 
};