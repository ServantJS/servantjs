#!/usr/bin/env bash

START_SCRIPT="servantjs-server.js"
INSTALL_DIR="/usr/local/servantjs/server"

SERVANT_DIR="/usr/local/servantjs"
INSTALL_DIR="${SERVANT_DIR}/server"
GIT_NAME="${SERVANT_DIR}/servantjs"
LINK_PATH="/usr/local/bin/servant-server"
BACKUP_DIR="${SERVANT_DIR}/.server_backup"
INSTALL_BACKUP_FILE="${SERVANT_DIR}/.server_install.sh"

function start {
    cd ${INSTALL_DIR}
    forever start ${START_SCRIPT}
}

function stop {
    cd ${INSTALL_DIR}
    forever stop ${START_SCRIPT}
}

function status {
    cd ${INSTALL_DIR}
    forever list | grep "pid\|${START_SCRIPT}"
}

function update {
    cp -r ${INSTALL_DIR} ${BACKUP_DIR}
    rm -f ${LINK_PATH}

    cp ${INSTALL_DIR}/install.sh ${INSTALL_BACKUP_FILE}

    rm -fr ${INSTALL_DIR}

    bash ${INSTALL_BACKUP_FILE}

    if [ $? != 0 ]; then
        rm -fr ${GIT_NAME}
        rm -fr ${INSTALL_DIR}
        ln -s ${INSTALL_DIR}/handler.sh ${LINK_PATH}
        mv ${BACKUP_DIR} ${INSTALL_DIR}
    else
        cp ${BACKUP_DIR}/config.json ${INSTALL_DIR}/
        rm -fr ${BACKUP_DIR}
    fi

    rm -f ${INSTALL_BACKUP_FILE}
}

case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop
    start
    ;;
  status)
    status
    ;;
  update)
    update
    ;;
  *)
    echo "Usage: servant-server <start|stop|restart|status|update>"
    exit 1
    ;;

esac