import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wordsRouter from "./words";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wordsRouter);

export default router;
