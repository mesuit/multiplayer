import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import downloadRouter from "./download";

const router: IRouter = Router();

router.use(healthRouter);
router.use(searchRouter);
router.use(downloadRouter);

export default router;
