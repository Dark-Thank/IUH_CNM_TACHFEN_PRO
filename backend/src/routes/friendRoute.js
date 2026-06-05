import express from "express";
import {
    acceptFriendRequest,
    blockFriend,
    checkBlockStatus,
    declineFriendRequest,
    getAllFriends,
    getBlockedUsers,
    getFriendRequests,
    removeFriend,
    sendFriendRequest,
    unblockFriend
} from "../controllers/friendController.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post('/requests', sendFriendRequest);

router.post('/requests/:requestId/accept', protectedRoute, acceptFriendRequest);
router.post('/requests/:requestId/decline', protectedRoute, declineFriendRequest);

router.post('/:friendId/block', protectedRoute, blockFriend);
router.post('/:friendId/unblock', protectedRoute, unblockFriend);
router.get('/:friendId/block-status', protectedRoute, checkBlockStatus);

router.get('/', protectedRoute, getAllFriends);
router.get('/blocked', protectedRoute, getBlockedUsers);
router.get('/requests', protectedRoute, getFriendRequests);

router.delete('/:friendId', protectedRoute, removeFriend);

export default router;
