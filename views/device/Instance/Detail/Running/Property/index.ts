import { running } from "../../../../../../assets";

export const imgMap = new Map<any, any>();
imgMap.set('txt', running.txt);
imgMap.set('doc', running.doc);
imgMap.set('xls', running.xls);
imgMap.set('ppt', running.ppt);
imgMap.set('docx', running.docx);
imgMap.set('xlsx', running.xlsx);
imgMap.set('pptx', running.pptx);
imgMap.set('pdf', running.pdf);
imgMap.set('img', running.img);
imgMap.set('error', running.error);
imgMap.set('video', running.video);
imgMap.set('other', running.other);
imgMap.set('obj', running.obj);

export const imgList = ['.jpg', '.png', '.swf', '.tiff'];
export const videoList = ['.m3u8', '.flv', '.mp4', '.rmvb', '.mvb'];
export const fileList = ['.txt', '.doc', '.xls', '.pdf', '.ppt', '.docx', '.xlsx', '.pptx'];

export const getType = (url: string) => {
    let t: string = '';
    [...imgList, ...videoList, ...fileList].map((item) => {
        const str = item.slice(1, item.length);
        if (url && String(url).indexOf(str) !== -1) {
            if (imgList.includes(item)) {
                t = 'img';
            } else if (videoList.includes(item)) {
                t = 'video';
            } else {
                t = str;
            }
        }
    });
    return t;
};
