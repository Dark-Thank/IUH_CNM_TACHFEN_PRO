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

const router = express.Router();

router.post('/requests', sendFriendRequest);

router.post('/requests/:requestId/accept', acceptFriendRequest);
router.post('/requests/:requestId/decline', declineFriendRequest);

router.post('/:friendId/block', blockFriend);
router.post('/:friendId/unblock', unblockFriend);
router.get('/:friendId/block-status', checkBlockStatus);

router.get('/', getAllFriends);
router.get('/blocked', getBlockedUsers);
router.get('/requests', getFriendRequests);

router.delete('/:friendId', removeFriend);

export default router;