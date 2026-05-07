import { Router, type IRouter } from "express";
import { listWords, listLanguages } from "../controllers/wordsController";

const router: IRouter = Router();

router.get("/words", listWords);
router.get("/languages", listLanguages);

export default router;
