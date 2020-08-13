OS:=$(shell (cat /etc/system-release | grep -iq fedora && echo fedora) || (cat /etc/system-release | grep -iq centos && echo centos) || echo unsupported)
YUM:=$(shell (dnf --version &>/dev/null && echo dnf || echo yum))

CURDIR:=$(PWD)
VA_CONFIG_FILE?=$(CURDIR)/config_files/config.sh
include $(VA_CONFIG_FILE)

VA_FOLDERS?=config config_ui detector mariadb lib photo ui

define npm_install
for dir in $(1); do \
[ -d $$dir ] && [ -e $$dir/package.json ] && cd $$dir && npm install || true; \
cd $(CURDIR); \
done
endef

.PHONY: all centos fedora unsupported deps node va config db pm2 ffserver cron sendmail omnidb switchoff start reset

all: | va db pm2 ffserver cron start

centos:
	@echo Installing dependencies on CentOS...
	-sudo $(YUM) -y --nogpgcheck install https://download1.rpmfusion.org/free/el/rpmfusion-free-release-$(shell rpm -E %centos).noarch.rpm
	-sudo $(YUM) -y --nogpgcheck install epel-release

fedora:
	@echo Installing dependencies on Fedora...
	-sudo $(YUM) -y --nogpgcheck install https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(shell rpm -E %fedora).noarch.rpm

unsupported:
	@echo Operating System Unsupported
	exit 1

deps: $(OS)
	-sudo $(YUM) -y --nogpgcheck install ffmpeg cmake gcc-c++

node: $(OS)
	-sudo $(YUM) -y --nogpgcheck install nodejs
	sudo npm install mustache -g

va: deps node
	@echo Installing Cascana.OKO...
	mkdir -p $(VA_PHOTO_BASE_DIR) $(VA_PHOTO_ARCHIVE_DIR) $(VA_PHOTO_ORIG_DIR)
	$(call npm_install,$(VA_FOLDERS))

config: node
	@echo Preparing configuration...
	./generate_configs.sh $(VA_CONFIG_FILE)

db: config
	@echo Installing Cascana DB...
	sudo yum -y --nogpgcheck install mariadb-server
	sudo systemctl start mariadb
	sudo systemctl enable mariadb
	sudo mysql < ./sql/init.sql
	sudo mysql < ./sql/staff.sql
	sudo mysql < ./sql/stats.sql
	-sudo mysql < ./sql/stats_data.sql

pm2: node
	@echo Installing PM2...
	sudo npm install pm2 -g
	sudo pm2 startup -u $(USER) --hp $(HOME)
	pm2 install pm2-logrotate

ffserver:
	@echo Downloading ffserver distro...
	curl -O https://ffmpeg.org/releases/ffmpeg-3.4.7.tar.xz
	tar -xvf ffmpeg-3.4.7.tar.xz -C ffserver --strip-components=1 --skip-old-files
	@echo Building ffserver...
	sudo $(YUM) -y --nogpgcheck install yasm
	cd ffserver && ./configure --disable-doc prefix=$(HOME) && make install

cron:
	@echo Installing crond...
	sudo $(YUM) -y --nogpgcheck install cronie
	sudo systemctl start crond
	sudo systemctl enable crond
	crontab -l | grep -q copy_photo.sh || \
	(crontab -l 2>/dev/null; echo "1 0 * * * $(HOME)/bin/copy_photo.sh $(VA_PHOTO_BASE_DIR) $(VA_PHOTO_ARCHIVE_DIR)") | crontab -
	mkdir -p $(HOME)/bin
	ln -sf $(CURDIR)/detector/copy_photo.sh $(HOME)/bin/

sendmail:
	@echo Installing sendmail...
	sudo $(YUM) -y --nogpgcheck install sendmail
	sudo systemctl start sendmail
	sudo systemctl enable sendmail

omnidb:
	@echo Installing OmniDB...
	sudo rpm -i https://omnidb.org/dist/2.17.0/omnidb-app_2.17.0-centos-amd64.rpm
	sudo rpm -i https://omnidb.org/dist/2.17.0/omnidb-server_2.17.0-centos7-amd64.rpm
	sudo systemctl start omnidb
	sudo systemctl enable omnidb

switch-off:
	@echo Disabling firewalld and SELinux...
	-sudo systemctl stop firewalld
	-sudo setenforce 0

start:
	@echo Starting Cascana.OKO...
	pm2 start pm.config.js
	pm2 save

reset:
	@echo Restarting processes with configuration update...
	-pm2 delete all
	pm2 cleardump
	pm2 start pm.config.js
	pm2 save

stop-all:
	@echo Stopping all components...
	-pm2 stop all
	-pm2 stop pm2-logrotate
	-sudo systemctl stop pm2-$(USER)
	-sudo systemctl stop mariadb
	-sudo systemctl stop crond
	-sudo systemctl stop sendmail
	-sudo systemctl stop omnidb

start-all:
	@echo Starting all components...
	-sudo systemctl start pm2-$(USER)
	-sudo systemctl start mariadb
	-sudo systemctl start crond
	-sudo systemctl start sendmail
	-sudo systemctl start omnidb
	pm2 start pm2-logrotate
	pm2 start all

disable-all:
	@echo Disabling all components...
	-sudo systemctl disable pm2-$(USER)
	-sudo systemctl disable mariadb
	-sudo systemctl disable crond
	-sudo systemctl disable sendmail
	-sudo systemctl disable omnidb

enable-all:
	@echo Enabling all components...
	-sudo systemctl enable pm2-$(USER)
	-sudo systemctl enable mariadb
	-sudo systemctl enable crond
	-sudo systemctl enable sendmail
	-sudo systemctl enable omnidb
