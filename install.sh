#!/usr/bin/env bash

set -eo pipefail

INSTALL_DIR="/usr/local/servantjs"
NAME="server"
GIT_NAME="servantjs"
GIT_PATH="https://github.com/ServantJS/${GIT_NAME}.git"

function verlte() {
    [ "$1" = "`echo -e "$1\n$2" | sort -V | head -n1`" ]
}

function verlt() {
    [ "$1" = "$2" ] && return 1 || verlte $1 $2
}

if ! which git > /dev/null; then
    echo "GIT does not install"
    exit 1
fi

if ! which node > /dev/null; then
    echo "Node.js does not install"
    exit 1
fi

if ! which npm > /dev/null; then
    echo "NPM does not install"
    exit 1
fi

NODE_VER=`node -v`
verlt ${NODE_VER#"v"} "5.0.0"  && (echo "Support only Node.js >= 5.x.x"; exit 1)

NPM_VER=`npm -v`
verlt ${NPM_VER} "2.0.0"  && (echo "Support only NPM >= 2.x.x"; exit 1)

exit 1

echo "Creating dir: ${INSTALL_DIR}"
mkdir -p ${INSTALL_DIR}

cd ${INSTALL_DIR}

echo "Cloning git repo ${GIT_PATH}"
git clone ${GIT_PATH}

mv ${GIT_NAME} ${NAME}

cd ./${NAME}
npm install

if ! which forever > /dev/null; then
    echo "Forever did not install. Start installing..."
    npm i -g forever
fi

chmod 777 ${INSTALL_DIR}/${NAME}/handler.sh
ln -s ${INSTALL_DIR}/${NAME}/handler.sh /usr/local/bin/servant-${NAME}

echo Servant-Server successfully installed
echo To run use next commad: servant-server start