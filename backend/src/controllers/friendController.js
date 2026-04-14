import Block from "../models/Block.js";
import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";


export const sendFriendRequest = async (req, res) => {
   try{
    const { to, message } = req.body;

    const from = req.user._id;

    if(from.toString() === to){
       return res.status(400).json({ message : "Bạn không thể gửi yêu cầu kết bạn cho chính mình"});
    }
    const userExitsts = await User.exists({_id: to});

    if(!userExitsts){
       return res.status(404).json({ message : "Người dùng không tồn tại"});
    }
    
    let userA = from.toString();
    let userB = to.toString();

    if(userA > userB){
       [userA, userB] = [userB, userA];
    }

    const [allreadyFriends, existingRequest] = await Promise.all([
        Friend.findOne({userA, userB}),
        FriendRequest.findOne({
            $or: [
                {from, to},
                {from: to, to: from}
            ]
        })
    ])

    if(allreadyFriends){
       return res.status(400).json({ message : "Bạn đã là bạn bè của người này"});
    }

    if(existingRequest){
        return res.status(400).json({ message : "Đã có lời mời kết bạn đang chờ"});
    }

    const request = await FriendRequest.create({
        from,
        to,
        message
    });

    return res.status(201).json({ message : "Đã gửi yêu cầu kết bạn thành công", request });

   } catch(error) {
    console.error('Lỗi khi gửi yêu cầu kết bạn', error);
    return res.status(500).json({ message : "Lỗi hệ thống"});
   }
};


export const acceptFriendRequest = async (req, res) => {
   try{
        const { requestId } = req.params;
        const userId = req.user._id;

        const request = await FriendRequest.findById(requestId);

        if(!request){
            return res.status(404).json({ message : "không tìm thấy lời mời kết bạn"});
        }

        if(request.to.toString() !== userId.toString()){
            return res.status(403).json({message: "Bạn không có quyền chấp nhận lời mời kết bạn này"});
        }

        const friend = await Friend.create({
            userA: request.from,
            userB: request.to
        });

        await FriendRequest.findByIdAndDelete(requestId);

        const from = await User.findById(request.from).select(
            "_id displayName avatarUrl"
        ).lean();

        return res.status(200).json({
             message : "Chấp nhận yêu cầu kết bạn thành công",
             newFriend: {
                _id: from?._id,
                displayName: from?.displayName,
                avatarUrl: from?.avatarUrl,
             },
            });


   } catch(error) {
    console.error('Lỗi khi chấp nhận yêu cầu kết bạn', error);
    return res.status(500).json({ message : "Lỗi hệ thống"});
   }
};

export const declineFriendRequest = async (req, res) => {
   try{
        const { requestId } = req.params;
        const userId = req.user._id;

        const request = await FriendRequest.findById(requestId);

        if(!request){
            return res.status(404).json({ message : "không tìm thấy lời mời kết bạn"});
        }

        if(request.to.toString() !== userId.toString()){
            return res
                .status(403)
                .json({message: "Bạn không có quyền từ chối lời mời kết bạn này"});
        }

        await FriendRequest.findByIdAndDelete(requestId);

        return res.sendStatus(204);



   } catch(error) {
    console.error('Lỗi khi từ chối yêu cầu kết bạn', error);
    return res.status(500).json({ message : "Lỗi hệ thống"});
   }
};

export const getAllFriends = async (req, res) => {
   try{
        const userId = req.user._id;
        const friendships = await Friend.find({
            $or: [
                {userA: userId},
                {userB: userId}
            ]
        }).populate('userA', '_id displayName avatarUrl username')
        .populate('userB', '_id displayName avatarUrl username')
        .lean();

        if(!friendships.length){
            return res.status(200).json({ friends: [] });
        }

        const friends = friendships.map((f) => 
            f.userA._id.toString() === userId.toString() ? f.userB : f.userA
        );
        return res.status(200).json({ friends });


   } catch(error) {
    console.error('Lỗi khi lấy danh sách bạn bè', error);
    return res.status(500).json({ message : "Lỗi hệ thống"});
   }
};

export const getFriendRequests = async (req, res) => {
   try{
    const userId = req.user._id;

    const populateFields = '_id username displayName avatarUrl';

    const [sent, received] = await Promise.all([
        FriendRequest.find({ from: userId }).populate('to', populateFields),
        FriendRequest.find({ to: userId }).populate('from', populateFields)
    ]);

    res.status(200).json({ sent, received });

   } catch(error) {
    console.error('Lỗi khi lấy danh sách yêu cầu kết bạn', error);
    return res.status(500).json({ message : "Lỗi hệ thống"});
   }
}

export const removeFriend = async (req, res) => {
   try{
        const { friendId } = req.params;
        const userId = req.user._id;

        let userA = userId.toString();
        let userB = friendId.toString();

        if(userA > userB){
            [userA, userB] = [userB, userA];
        }

        const friendship = await Friend.findOne({userA, userB});

        if(!friendship){
            return res.status(404).json({ message : "Không tìm thấy bạn bè này"});
        }

        await Friend.findByIdAndDelete(friendship._id);

        return res.status(200).json({ message : "Xóa bạn thành công"});

   } catch(error) {
    console.error('Lỗi khi xóa bạn', error);
    return res.status(500).json({ message : "Lỗi hệ thống"});
   }
}

export const blockFriend = async (req, res) => {
   try {
        const { friendId } = req.params;
        const userId = req.user._id;

        if(userId.toString() === friendId){
            return res.status(400).json({ message: "Bạn không thể chặn chính mình" });
        }

        const userExists = await User.exists({ _id: friendId });
        if(!userExists){
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        // Check if already blocked
        const existingBlock = await Block.findOne({ blocker: userId, blocked: friendId });
        
        if(existingBlock){
            return res.status(400).json({ message: "Bạn đã chặn người dùng này" });
        }

        // Create block
        await Block.create({
            blocker: userId,
            blocked: friendId
        });

        return res.status(200).json({ message: "Đã chặn bạn thành công" });

   } catch(error) {
        console.error('Lỗi khi chặn bạn', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
   }
}

export const unblockFriend = async (req, res) => {
   try {
        const { friendId } = req.params;
        const userId = req.user._id;

        const block = await Block.findOne({ blocker: userId, blocked: friendId });

        if(!block){
            return res.status(404).json({ message: "Không tìm thấy lệnh chặn này" });
        }

        await Block.deleteOne({ _id: block._id });

        return res.status(200).json({ message: "Đã bỏ chặn bạn thành công" });

   } catch(error) {
        console.error('Lỗi khi bỏ chặn bạn', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
   }
}

export const checkBlockStatus = async (req, res) => {
   try {
        const { friendId } = req.params;
        const userId = req.user._id;

        const block = await Block.findOne({ blocker: userId, blocked: friendId });

        return res.status(200).json({ isBlocked: !!block });

   } catch(error) {
        console.error('Lỗi khi kiểm tra trạng thái chặn', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
   }
}

export const getBlockedUsers = async (req, res) => {
   try {
        const userId = req.user._id;

        const blockedUsers = await Block.find({ blocker: userId })
            .populate('blocked', '_id displayName avatarUrl username')
            .lean();

        if(!blockedUsers.length){
            return res.status(200).json({ blockedUsers: [] });
        }

        const blocked = blockedUsers.map((b) => b.blocked);
        return res.status(200).json({ blockedUsers: blocked });

   } catch(error) {
        console.error('Lỗi khi lấy danh sách chặn', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
   }
}