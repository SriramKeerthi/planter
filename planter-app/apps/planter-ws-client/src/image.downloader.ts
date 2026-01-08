import fs from 'fs';
import sharp from 'sharp';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { ReadableStream } from 'stream/web';

const MAX_SIZE = 400000;

const downloadUrlToFile = async (url: string, fileName: string) => {
    console.log('Downloading', url, 'to', fileName);
    const imageResponse = await fetch(url);
    const file = fs.createWriteStream(fileName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await finished(Readable.fromWeb(imageResponse.body as ReadableStream<any>).pipe(file));
}

const downloadImageGiphy = async (fileName: string, searchTerm: string) => {
    const GIPHY_KEY = 'TAgiI8DXXy9lnE80QQizgTGSUjfnrY1O';
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURI(searchTerm)}&limit=1&random_id=1&rating=r&fixed_width=small`;
    const response = await fetch(url);
    const imageId = (await response.json()).data.id;
    const imageUrl = `https://i.giphy.com/${imageId}.gif`;
    await downloadUrlToFile(imageUrl, fileName);
}

const downloadImageTenor = async (fileName: string, searchTerm: string) => {
    const TENOR_KEY = 'AIzaSyAZPgdq-yTKvYuaGNuwh0yqvodRBUVrY18';
    const url = `https://tenor.googleapis.com/v2/search?key=${TENOR_KEY}&q=${encodeURI(searchTerm)}&limit=1&media_filter=mediumgif,tinygif&ar_range=wide&random=true`;
    const response = await fetch(url);
    const respJson = await response.json();
    const imageUrl = (respJson).results[0].media_formats.tinygif.url;
    await downloadUrlToFile(imageUrl, fileName);
}

const downloadImageGifer = async (fileName: string, searchTerm: string) => {
    const totalImages = 10;
    const url = `https://gifer.com/api/search/media?q=${encodeURI(searchTerm)}&limit=${totalImages}&skip=0&include=creator,tags.tag`
    const response = await (await fetch(url)).json();
    if (response.length === 0) {
        console.log('No images found');
        return;
    }
    const randomIndex = Math.floor(Math.random() * totalImages);
    const id = response[randomIndex].id;
    const imageUrl = `https://i.gifer.com/embedded/download/${id}.gif`;
    await downloadUrlToFile(imageUrl, fileName);
}

const resizeImage = async (fileName: string, size: number, maxSize: number) => {
    const width = size;
    const height = size == 128 ? 64 : 135;
    const buffer = await sharp(fileName, {
        animated: true
    })
        .resize(width, height, { fit: 'cover' })
        .toBuffer()
        .catch(err => {
            console.error(err);
        });
    if (!buffer) {
        return;
    }
    // fs.writeFileSync(`${fileName.slice(0, -4)}.resized.gif`, buffer, { flag: 'w' });

    if (buffer.length > maxSize) {
        console.log(`Image too large: ${buffer.length} Max size: ${maxSize}`);
        return;
    }

    return buffer
}

export const fetchRandomImage = async (size: number, searchTerm: string, maxSize = MAX_SIZE, tries = 3): Promise<Buffer | undefined> => {
    if (tries === 0) {
        console.log('Failed to download image');
        return;
    }

    try {
        let fileName;
        if (searchTerm === 'chosen') {
            const files = fs.readdirSync('./assets/chosen').filter(file => file.endsWith('.gif') && !file.endsWith('.resized.gif'));
            fileName = `./assets/chosen/${files[Math.floor(Math.random() * files.length)]}`;
            console.log("Chosen file", fileName);
        } else {
            fileName = `./assets/image_${searchTerm}_${size}.gif`;
            // await downloadImageGiphy(fileName, searchTerm);
            await downloadImageTenor(fileName, searchTerm);
            // await downloadImageGifer(fileName, searchTerm);
        }
        const buffer = await resizeImage(fileName, size, maxSize ?? MAX_SIZE);
        if (buffer) {
            return buffer;
        }
    } catch (err) {
        console.error(err);
    }
    return await fetchRandomImage(size, searchTerm, maxSize, tries - 1);
}
