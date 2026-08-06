import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';

const DEFAULT_ASPECT_RATIO = 1.6;

const ResponsiveImage = ({ uri, style, fallbackAspectRatio = DEFAULT_ASPECT_RATIO, ...props }) => {
    const [aspectRatio, setAspectRatio] = useState(fallbackAspectRatio);

    useEffect(() => {
        let isMounted = true;

        if (!uri) {
            setAspectRatio(fallbackAspectRatio);
            return;
        }

        Image.getSize(
            uri,
            (width, height) => {
                if (!isMounted || !width || !height) {
                    return;
                }

                setAspectRatio(width / height);
            },
            () => {
                if (isMounted) {
                    setAspectRatio(fallbackAspectRatio);
                }
            }
        );

        return () => {
            isMounted = false;
        };
    }, [uri, fallbackAspectRatio]);

    if (!uri) {
        return null;
    }

    return <Image source={{ uri }} style={[styles.image, { aspectRatio }, style]} {...props} />;
};

const styles = StyleSheet.create({
    image: {
        width: '100%',
    },
});

export default ResponsiveImage;
