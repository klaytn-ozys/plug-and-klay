export function addPublicKey (option) {
    return {
        type: 'ADD_PUBLIC_KEY',
        payload: option,
    }
}

export function removePublicKey (key) {
    return {
        type: 'REMOVE_PUBLIC_KEY',
        payload: key,
    }
}

export function addKaikasConnection() {
    return {
        type: 'ADD_KAIKAS_CONNECTION'
    }
}

export function removeKaikasConnection() {
    return {
        type: 'REMOVE_KAIKAS_CONNECTION'
    }
}